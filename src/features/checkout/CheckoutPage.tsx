import { useQuery } from '@tanstack/react-query'
import { Link, Navigate } from '@tanstack/react-router'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { profileQuery } from '@/api/profile'
import { walletsQuery } from '@/api/wallets'
import { useSession } from '@/auth/useSession'
import type { Account, Cart } from '@/contracts'
import { ErrorState, PriceSummary } from '@/components/kurio'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CHECKOUT_BLOCK_MESSAGE, lineKey } from '@/features/cart/cartView'
import { BLOCKED_CTA_CLASS, GRID_CLASS, PAGE_CLASS } from '@/features/cart/layout'
import { QuoteErrorState } from '@/features/cart/QuoteErrorState'
import { useCart } from '@/features/cart/useCart'
import { QUOTE_ISSUES_MESSAGE, useCartQuote } from '@/features/cart/useCartQuote'
import { sortWallets } from '@/lib/wallets'
import { cn } from '@/lib/utils'
import { pendingAttempt, pendingAttemptSnapshot } from './checkoutDraft'
import { ReviewSection, Step } from './CheckoutStep'
import { AttemptReview, OrderInProgressAlert, PendingOrderAlert, RecoverPendingOrder, type OrderInProgress } from './PendingAttempt'
import { REQUOTE_FAILED_MESSAGE, VALUES_CHANGED_MESSAGE } from './placeOrder'
import { attemptLines } from './reviewSource'
import { changeMessages } from './reviewSnapshot'
import { useCheckoutDraft } from './useCheckoutDraft'
import { useNftDetails } from './useNftDetails'
import { usePendingOrder } from './usePendingOrder'
import { useCheckoutOrder } from './usePlaceOrder'
import { useWalletConnection } from './useWalletConnection'
import { WalletStep } from './WalletStep'

export { ATTEMPT_CONFLICT_MESSAGE, ORDER_IN_PROGRESS_MESSAGE, ORDER_LOAD_FAILED_MESSAGE } from './PendingAttempt'

const CONNECT_WALLET_MESSAGE = 'Conecte uma carteira para confirmar.'

/**
 * Pagamento (`/checkout`, sob `_authenticated`): dados do colecionador, carteira (seleção + conexão) e
 * revisão com o resumo da cotação. "Confirmar compra" recota e compara com o revisado antes de enviar (R3);
 * o envio é idempotente, com a chave guardada no rascunho (R4). Nenhum valor é somado aqui.
 *
 * As partes: o envio e o revisado em `usePlaceOrder.ts` (`usePlaceOrder`, `useCheckoutOrder`), a carteira em
 * `useWalletConnection.ts` e os avisos da tentativa pendente em `PendingAttempt.tsx`.
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
  const { draft, store: drafts } = useCheckoutDraft(account.id)
  const pendingOrder = usePendingOrder(account.id, draft, drafts)

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
    // carrinho). Sem isto o refresh mandaria para /cart sem dizer o que houve com o pedido. Com o pedido
    // conhecido (`orderId`) e já final, `usePendingOrder` limpa o rascunho e a página volta ao /cart
    if (pendingOrder.kind === 'none') return <Navigate to="/cart" replace />
    // O que a tentativa compra (snapshot, só exibição): o carrinho já não diz, e "Tentar de novo" envia o mesmo corpo
    const snapshot = pendingAttemptSnapshot(draft)
    const alert =
      pendingOrder.kind === 'in-progress' ? (
        <OrderInProgressAlert state={pendingOrder} />
      ) : (
        <RecoverPendingOrder accountId={account.id} />
      )
    body = snapshot ? <AttemptReview snapshot={snapshot}>{alert}</AttemptReview> : alert
  } else body = (
    <CheckoutContent
      account={account}
      cart={{ items: [...cart.items], couponCode: cart.couponCode }}
      orderInProgress={pendingOrder.kind === 'in-progress' ? pendingOrder : undefined}
    />
  )

  return <Page>{body}</Page>
}

function CheckoutContent({ account, cart, orderInProgress }: { account: Account; cart: Cart; orderInProgress?: OrderInProgress }) {
  const accountId = account.id
  const { draft, store: drafts } = useCheckoutDraft(accountId)

  const profile = useQuery(profileQuery(accountId))
  const wallets = useQuery(walletsQuery(accountId))
  const quote = useCartQuote(accountId, cart)
  const { submitting, resending, source, reviewed, notice, confirm: confirmOrder, resend } = useCheckoutOrder({
    accountId,
    cartItems: cart.items,
    draft,
    quote,
  })
  const attempt = source.kind === 'attempt' ? source.snapshot : undefined
  // Nome e arte dos NFTs do carrinho e da tentativa: com a união, quando a tentativa termina e a Revisão volta ao
  // carrinho, as artes já estão carregadas (nada pisca em skeleton)
  const nftOf = useNftDetails([...cart.items, ...(attempt?.items ?? [])].map((item) => item.nftId))

  const sortedWallets = wallets.data ? sortWallets(wallets.data) : undefined
  const { selectedId, connected, connection, selectWallet, connect, provider, selectProvider, disconnect } = useWalletConnection({ draft, drafts, wallets: sortedWallets })
  const pending = pendingAttempt(draft)

  const { quote: quoteData, recalculating, staleAfterError, issues, hasIssues } = quote
  const messages = notice?.kind === 'changed' ? changeMessages(notice.changes) : undefined

  const canConfirm = quote.canCheckout && connected && reviewed !== undefined && !pending
  // Motivos do "Confirmar compra" bloqueado, ligados a ele por `aria-describedby`
  const issuesId = useId()
  const blockId = useId()
  const connectId = useId()
  const showIssues = !attempt && (hasIssues || notice?.kind === 'blocked')
  const blockReason = quote.block !== undefined && quote.block !== 'issues' ? CHECKOUT_BLOCK_MESSAGE[quote.block] : undefined
  const describedBy = canConfirm
    ? undefined
    : [!connected && connectId, showIssues && issuesId, blockReason && blockId].filter(Boolean).join(' ') || undefined
  const confirm = () => {
    if (!canConfirm || !selectedId) return
    confirmOrder(selectedId)
  }

  // O CTA do resumo. Pedido criado e ainda em andamento: o aviso dele (durante o envio que acabou de criar o
  // pedido a página está navegando, e o "Confirmando…" fica). Tentativa pendente: "Tentar de novo", exceto no
  // "Confirmando…" de uma confirmação nova (o `withOrderKey` grava a tentativa antes do POST). Senão, "Confirmar compra"
  const confirmingNew = submitting && !resending
  const cta = orderInProgress !== undefined && !submitting ? 'in-progress' : pending && !confirmingNew ? 'retry' : 'confirm'

  const lines = attempt
    ? attemptLines(attempt, nftOf)
    : source.items.map((item) => {
        const key = lineKey(item)
        return {
          item,
          nft: nftOf(item.nftId),
          unitPrice: quote.unitPriceOf(item),
          issue: issues.get(key),
          message: (notice?.kind === 'items' ? notice.fieldErrors[key] : undefined) ?? messages?.byLine.get(key),
        }
      })

  let staleMessage: string | undefined
  let staleAction: ReactNode
  if (attempt) {
    // Os valores da tentativa são os do pedido enviado: a cotação do carrinho atual não os torna desatualizados
  } else if (staleAfterError) {
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
            provider={provider}
            onSelectProvider={selectProvider}
            onConnect={() => void connect()}
            onDisconnect={disconnect}
            locked={pending !== undefined}
          />
        </Step>

        <ReviewSection number={3} title="Revisão" attempt={attempt !== undefined} lines={lines} />
      </div>

      <aside aria-label="Resumo do pedido" className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4 lg:sticky lg:top-24">
        {attempt ? (
          <PriceSummary title="Resumo" quote={attempt} />
        ) : quote.isError && !quoteData ? (
          <QuoteErrorState quote={quote} />
        ) : (
          <PriceSummary
            title="Resumo"
            quote={quoteData}
            stale={staleMessage !== undefined}
            staleMessage={staleMessage}
            staleAction={staleAction}
          />
        )}

        {showIssues && (
          <div role="alert" className="text-destructive text-caption flex flex-col gap-2">
            <p id={issuesId}>{QUOTE_ISSUES_MESSAGE}</p>
            <Link to="/cart" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'self-start')}>
              Voltar ao carrinho
            </Link>
          </div>
        )}
        {notice?.kind === 'requote-failed' && <Alert>{REQUOTE_FAILED_MESSAGE}</Alert>}
        {notice?.kind === 'fatal' && <Alert>{notice.message}</Alert>}

        {cta === 'in-progress' && orderInProgress ? (
          <OrderInProgressAlert state={orderInProgress} />
        ) : cta === 'retry' ? (
          <PendingOrderAlert submitting={resending} onResend={resend} />
        ) : (
          <Button
            type="button"
            size="lg"
            aria-busy={submitting || undefined}
            aria-disabled={!canConfirm || submitting || undefined}
            aria-describedby={submitting ? undefined : describedBy}
            className={BLOCKED_CTA_CLASS}
            onClick={confirm}
          >
            {submitting && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {submitting ? 'Confirmando…' : 'Confirmar compra'}
          </Button>
        )}
        {!pending && !submitting && blockReason && (
          <p id={blockId} className="text-muted-foreground text-caption">
            {blockReason}
          </p>
        )}
        {!connected && !pending && (
          <p id={connectId} className="text-muted-foreground text-caption">
            {CONNECT_WALLET_MESSAGE}
          </p>
        )}
      </aside>
    </div>
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
