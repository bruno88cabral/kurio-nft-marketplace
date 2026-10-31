import { keepPreviousData, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from '@tanstack/react-router'
import { LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { nftDetailQuery } from '@/api/nfts'
import { createOrder } from '@/api/orders'
import { profileQuery } from '@/api/profile'
import { quoteQuery } from '@/api/quotes'
import { connectWallet, walletKeys, walletsQuery } from '@/api/wallets'
import { captureSession } from '@/auth/sessionGuard'
import { useSession } from '@/auth/useSession'
import { ApiError, type Account, type Cart, type Id, type Quote } from '@/contracts'
import { ErrorState, PriceSummary } from '@/components/kurio'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { issuesByLine, lineKey } from '@/features/cart/cartView'
import { useCart } from '@/features/cart/useCart'
import { sortWallets } from '@/lib/wallets'
import { cn } from '@/lib/utils'
import { pendingAttempt } from './checkoutDraft'
import {
  confirmPurchase,
  ORDER_FAILED_MESSAGE,
  REQUOTE_FAILED_MESSAGE,
  resendPendingOrder,
  TRANSIENT_ORDER_MESSAGE,
  VALUES_CHANGED_MESSAGE,
  type PlaceOrderDeps,
  type PlaceOrderOutcome,
} from './placeOrder'
import { ReviewStep } from './ReviewStep'
import { changeMessages, snapshotOf, type ReviewSnapshot, type SnapshotChange } from './reviewSnapshot'
import { useCheckoutDraft } from './useCheckoutDraft'
import { WalletStep, type WalletConnection } from './WalletStep'

const PAGE_CLASS = 'mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 pb-8 md:px-6 md:py-8'
const GRID_CLASS = 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10'
/** Mesmo padrão do CTA do carrinho: `aria-disabled` (foco preservado) com o estilo de bloqueado. */
const BLOCKED_CTA_CLASS =
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-primary aria-disabled:active:translate-y-0'
const WALLET_FAILURE_MESSAGE = 'Não foi possível conectar a carteira. Tente de novo.'

/** O que a última tentativa deixou para a tela (a falha transitória vem do rascunho, não daqui). */
type Notice =
  | { kind: 'changed'; changes: SnapshotChange[] }
  | { kind: 'items'; fieldErrors: Record<string, string> }
  | { kind: 'quote'; message: string }
  | { kind: 'blocked' }
  | { kind: 'requote-failed' }
  | { kind: 'fatal'; message: string }

/**
 * Pagamento (`/checkout`, sob `_authenticated`): dados do colecionador, carteira (seleção + conexão) e
 * revisão com o resumo da cotação. "Confirmar compra" recota e compara com o revisado antes de enviar (R3);
 * o envio é idempotente, com a chave guardada no rascunho (R4). Nenhum valor é somado aqui.
 */
export function CheckoutPage() {
  const { account } = useSession()
  return account ? <Checkout account={account} /> : <Page><CheckoutSkeleton /></Page>
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div className={PAGE_CLASS}>
      <h1 className="text-heading">Pagamento</h1>
      {children}
    </div>
  )
}

function Checkout({ account }: { account: Account }) {
  const cart = useCart()
  const { draft } = useCheckoutDraft(account.id)

  let body
  if (cart.isPending) body = <CheckoutSkeleton />
  else if (cart.isError) {
    body = (
      <ErrorState
        title="Não foi possível carregar o carrinho."
        description="Verifique sua conexão e tente de novo."
        onRetry={() => void cart.refetch()}
      />
    )
  } else if (cart.items.length === 0) {
    // Carrinho vazio com envio pendente: o pedido pode ter sido confirmado (o servidor tira o comprado do
    // carrinho). Sem isto o refresh mandaria para /cart sem dizer o que houve com o pedido
    if (!pendingAttempt(draft)) return <Navigate to="/cart" replace />
    body = <RecoverPendingOrder accountId={account.id} />
  } else body = <CheckoutContent account={account} cart={{ items: [...cart.items], couponCode: cart.couponCode }} />

  return <Page>{body}</Page>
}

/** Só o "Tentar de novo" da tentativa gravada (carrinho já vazio). */
function RecoverPendingOrder({ accountId }: { accountId: Id }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { store: drafts } = useCheckoutDraft(accountId)
  const [submitting, setSubmitting] = useState(false)
  const lock = useRef(false)

  const resend = async () => {
    if (lock.current) return
    lock.current = true
    setSubmitting(true)
    const outcome = await resendPendingOrder({ queryClient, accountId, drafts, createOrder, sameSession: captureSession() })
    if (outcome?.kind === 'created') {
      await navigate({ to: '/orders/$orderId', params: { orderId: outcome.order.id }, replace: true })
      return
    }
    // 409 descarta a tentativa (a tela volta ao /cart); `transient` mantém o aviso
    // `fatal` descarta a tentativa: sem ela e com o carrinho vazio a página volta ao /cart, então o motivo vai no toast
    if (outcome?.kind === 'fatal') toast.error(outcome.error instanceof ApiError ? outcome.error.message : ORDER_FAILED_MESSAGE)
    lock.current = false
    setSubmitting(false)
  }

  return <PendingOrderAlert submitting={submitting} onResend={() => void resend()} />
}

/** O botão "Confirmar compra" sai e este entra no lugar: o foco vai para "Tentar de novo" (não cai no `<body>`). */
function PendingOrderAlert({ submitting, onResend }: { submitting: boolean; onResend: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    buttonRef.current?.focus()
  }, [])
  return (
    <div role="alert" className="border-destructive/40 flex flex-col gap-2 rounded-md border p-3">
      <p className="text-body inline-flex items-start gap-2 font-medium">
        <TriangleAlert aria-hidden className="text-destructive mt-0.5 size-4 shrink-0" />
        {TRANSIENT_ORDER_MESSAGE}
      </p>
      <p className="text-muted-foreground text-caption">
        O pedido pode ter sido recebido. Tentar de novo reenvia o mesmo pedido e não cobra duas vezes.
      </p>
      <Button
        ref={buttonRef}
        type="button"
        size="lg"
        aria-busy={submitting || undefined}
        aria-disabled={submitting || undefined}
        className={BLOCKED_CTA_CLASS}
        onClick={() => !submitting && onResend()}
      >
        {submitting ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <RefreshCw aria-hidden />}
        Tentar de novo
      </Button>
    </div>
  )
}

function CheckoutContent({ account, cart }: { account: Account; cart: Cart }) {
  const accountId = account.id
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { draft, store: drafts } = useCheckoutDraft(accountId)

  const profile = useQuery(profileQuery(accountId))
  const wallets = useQuery(walletsQuery(accountId))
  const details = useQueries({ queries: cart.items.map((item) => nftDetailQuery(item.nftId)) })
  const quote = useQuery({ ...quoteQuery(accountId, cart), placeholderData: keepPreviousData })

  // O revisado: a primeira cotação mostrada, e depois só o que a tela mostrou ao avisar de uma mudança
  const [reviewed, setReviewed] = useState<ReviewSnapshot>()
  if (!reviewed && quote.data && !quote.isPlaceholderData) setReviewed(snapshotOf(quote.data))
  useEffect(() => {
    if (reviewed && drafts.get().reviewedQuoteId !== reviewed.quoteId) {
      drafts.set({ ...drafts.get(), reviewedQuoteId: reviewed.quoteId })
    }
  }, [reviewed, drafts])

  const [notice, setNotice] = useState<Notice>()
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const [connecting, setConnecting] = useState(false)
  const [walletError, setWalletError] = useState<string>()

  const sortedWallets = wallets.data ? sortWallets(wallets.data) : undefined
  const pending = pendingAttempt(draft)
  // Com tentativa pendente vale a carteira dela; senão a escolhida, ou a principal
  const selectedId: Id | undefined =
    pending?.body.walletId ??
    (sortedWallets?.some((w) => w.id === draft.walletId) ? draft.walletId : sortedWallets?.[0]?.id)
  const connected = selectedId !== undefined && draft.connectedWalletId === selectedId
  const connection: WalletConnection = connected
    ? { status: 'connected' }
    : connecting
      ? { status: 'connecting' }
      : walletError
        ? { status: 'rejected', message: walletError }
        : { status: 'idle' }

  const selectWallet = (walletId: Id) => {
    if (pending || walletId === selectedId) return
    setWalletError(undefined)
    // Trocar de carteira desconecta a anterior
    const next = { ...drafts.get(), walletId }
    delete next.connectedWalletId
    drafts.set(next)
  }

  const connect = async () => {
    if (!selectedId || connecting) return
    const sameSession = captureSession()
    const walletId = selectedId
    setConnecting(true)
    setWalletError(undefined)
    try {
      await connectWallet(walletId)
      if (!sameSession()) return
      drafts.set({ ...drafts.get(), walletId, connectedWalletId: walletId })
    } catch (error) {
      if (!sameSession()) return
      setWalletError(error instanceof ApiError && error.status === 409 ? error.message : WALLET_FAILURE_MESSAGE)
    } finally {
      setConnecting(false)
    }
  }

  const requote = async (): Promise<Quote> => {
    const result = await quote.refetch()
    if (result.isError || !result.data) throw result.error ?? new Error('Cotação indisponível.')
    return result.data
  }

  const deps = (): PlaceOrderDeps => ({ queryClient, accountId, drafts, createOrder, sameSession: captureSession() })

  const handle = async (outcome: PlaceOrderOutcome | undefined) => {
    if (!outcome || outcome.kind === 'stale-session') return
    switch (outcome.kind) {
      case 'created':
        // O pedido já está no cache: a Confirmação abre sem esperar; `replace` tira o Pagamento do Voltar
        await navigate({ to: '/orders/$orderId', params: { orderId: outcome.order.id }, replace: true })
        return
      case 'changed':
        setReviewed(outcome.snapshot)
        setNotice({ kind: 'changed', changes: outcome.changes })
        return
      case 'blocked':
        setReviewed(outcome.snapshot)
        setNotice({ kind: 'blocked' })
        return
      case 'requote-failed':
        setNotice({ kind: 'requote-failed' })
        return
      case 'transient':
        // A tentativa ficou no rascunho: o aviso com "Tentar de novo" aparece por ela
        setNotice(undefined)
        return
      case 'fatal':
        // A tentativa já saiu do rascunho: o CTA volta e a carteira destrava. A lista pode ter mudado
        // (carteira removida em outra aba): recarrega para o usuário escolher outra
        void queryClient.invalidateQueries({ queryKey: walletKeys.list(accountId) })
        setNotice({
          kind: 'fatal',
          message: outcome.error instanceof ApiError ? outcome.error.message : ORDER_FAILED_MESSAGE,
        })
        return
      case 'items':
      case 'quote': {
        setNotice(
          outcome.kind === 'items'
            ? { kind: 'items', fieldErrors: outcome.fieldErrors }
            : { kind: 'quote', message: outcome.message },
        )
        // A chave foi descartada: recota para a tela mostrar os valores atuais, que passam a ser o revisado
        try {
          setReviewed(snapshotOf(await requote()))
        } catch {
          // A cotação antiga segue na tela; o próximo clique recota de novo
        }
        return
      }
    }
  }

  const run = async (action: () => Promise<PlaceOrderOutcome | undefined>) => {
    if (submitLock.current) return
    submitLock.current = true
    setSubmitting(true)
    let navigated = false
    try {
      const outcome = await action()
      navigated = outcome?.kind === 'created'
      await handle(outcome)
    } finally {
      // Depois do sucesso a página sai; a trava fica até lá para não haver segundo envio
      if (!navigated) {
        submitLock.current = false
        setSubmitting(false)
      }
    }
  }

  const quoteData = quote.data
  const recalculating = quote.isPlaceholderData
  const staleAfterError = quote.isError && quoteData !== undefined
  const issues = issuesByLine(quoteData?.issues)
  const hasIssues = issues.size > 0
  const messages = notice?.kind === 'changed' ? changeMessages(notice.changes) : undefined

  const canConfirm =
    connected && quoteData !== undefined && reviewed !== undefined && !recalculating && !quote.isError && !hasIssues && !pending
  const confirm = () => {
    if (!canConfirm || !selectedId || !reviewed) return
    setNotice(undefined)
    void run(() => confirmPurchase(deps(), { reviewed, walletId: selectedId, requote }))
  }
  const [resending, setResending] = useState(false)
  const resend = () => {
    if (submitLock.current) return
    setResending(true)
    void run(() => resendPendingOrder(deps())).finally(() => setResending(false))
  }

  const lines = cart.items.map((item, index) => {
    const key = lineKey(item)
    return {
      item,
      nft: details[index]?.data,
      unitPrice: quoteData?.items.find((q) => lineKey(q) === key)?.unitPrice,
      issue: issues.get(key),
      message: (notice?.kind === 'items' ? notice.fieldErrors[key] : undefined) ?? messages?.byLine.get(key),
    }
  })

  let staleMessage: string | undefined
  let staleAction: ReactNode
  if (staleAfterError) {
    staleMessage = 'Não foi possível atualizar a cotação. Tente de novo antes de confirmar.'
    staleAction = (
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => void quote.refetch()}>
        Tentar novamente
      </Button>
    )
  } else if (recalculating) staleMessage = 'Recalculando os valores.'
  else if (notice?.kind === 'changed') {
    staleMessage = VALUES_CHANGED_MESSAGE
    staleAction = messages && messages.summary.length > 0 && (
      <ul className="list-disc pl-5">
        {messages.summary.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    )
  } else if (notice?.kind === 'items') staleMessage = 'Alguns itens mudaram desde a revisão. Confira os valores e confirme de novo.'
  else if (notice?.kind === 'quote') staleMessage = `${notice.message} Os valores foram atualizados; confirme de novo.`

  return (
    <div className={GRID_CLASS}>
      <div className="flex min-w-0 flex-col gap-6">
        <Step number={1} title="Seus dados" action={<Link to="/profile" className={buttonVariants({ variant: 'link', size: 'sm' })}>Editar</Link>}>
          <dl className="text-body grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt className="text-muted-foreground">Nome</dt>
            <dd>{profile.data?.displayName ?? (profile.isError ? account.name : <Skeleton className="h-4 w-32 motion-reduce:animate-none" />)}</dd>
            <dt className="text-muted-foreground">E-mail</dt>
            <dd className="break-all">{account.email}</dd>
          </dl>
        </Step>

        <Step number={2} title="Carteira">
          <WalletStep
            wallets={sortedWallets}
            isError={wallets.isError}
            retrying={wallets.isFetching}
            onRetry={() => void wallets.refetch()}
            selectedId={selectedId}
            onSelect={selectWallet}
            connection={connection}
            onConnect={() => void connect()}
            locked={pending !== undefined}
          />
        </Step>

        <Step number={3} title="Revisão">
          <ReviewStep lines={lines} />
        </Step>
      </div>

      <aside aria-label="Resumo do pedido" className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4 lg:sticky lg:top-24">
        {quote.isError && !quoteData ? (
          <ErrorState title="Não foi possível calcular o total." onRetry={() => void quote.refetch()} retrying={quote.isFetching} className="px-3 py-6" />
        ) : (
          <PriceSummary
            title="Resumo"
            quote={quoteData}
            stale={staleMessage !== undefined}
            staleMessage={staleMessage}
            staleAction={staleAction}
          />
        )}

        {(hasIssues || notice?.kind === 'blocked') && (
          <div role="alert" className="text-destructive text-caption flex flex-col gap-2">
            <p>Há itens indisponíveis ou com preço alterado. Ajuste o carrinho para continuar.</p>
            <Link to="/cart" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'self-start')}>
              Voltar ao carrinho
            </Link>
          </div>
        )}
        {notice?.kind === 'requote-failed' && <Alert>{REQUOTE_FAILED_MESSAGE}</Alert>}
        {notice?.kind === 'fatal' && <Alert>{notice.message}</Alert>}

        {pending && !(submitting && !resending) ? (
          <PendingOrderAlert submitting={resending} onResend={resend} />
        ) : (
          <Button
            type="button"
            size="lg"
            aria-busy={submitting || undefined}
            aria-disabled={!canConfirm || submitting || undefined}
            className={BLOCKED_CTA_CLASS}
            onClick={confirm}
          >
            {submitting && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {submitting ? 'Confirmando…' : 'Confirmar compra'}
          </Button>
        )}
        {!connected && !pending && <p className="text-muted-foreground text-caption">Conecte uma carteira para confirmar.</p>}
      </aside>
    </div>
  )
}

function Step({ number, title, action, children }: { number: number; title: string; action?: ReactNode; children: ReactNode }) {
  const id = `checkout-etapa-${number}`
  return (
    <section aria-labelledby={id} className="border-border flex flex-col gap-4 rounded-lg border p-4">
      <header className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-body-lg flex items-center gap-2 font-medium">
          <span aria-hidden className="bg-muted text-caption flex size-6 items-center justify-center rounded-full">
            {number}
          </span>
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-destructive text-caption inline-flex items-start gap-1.5">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  )
}

function CheckoutSkeleton() {
  return (
    <div aria-busy className={GRID_CLASS}>
      <div className="flex flex-col gap-6" aria-hidden>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded-lg motion-reduce:animate-none" />
        ))}
      </div>
      <Skeleton aria-hidden className="h-64 rounded-lg motion-reduce:animate-none" />
      <p role="status" className="sr-only">
        Carregando o pagamento…
      </p>
    </div>
  )
}
