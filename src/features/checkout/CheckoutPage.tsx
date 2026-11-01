import { useQuery } from '@tanstack/react-query'
import { Link, Navigate } from '@tanstack/react-router'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { useId, useRef, useState, type ReactNode } from 'react'
import { profileQuery } from '@/api/profile'
import { walletsQuery } from '@/api/wallets'
import { useSession } from '@/auth/useSession'
import type { Account, Cart } from '@/contracts'
import { CouponInput, ErrorState, PriceSummary } from '@/components/kurio'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { hasErrors } from '@/features/account/validation'
import { CHECKOUT_BLOCK_MESSAGE, couponStatus, lineKey } from '@/features/cart/cartView'
import { BLOCKED_CTA_CLASS, PAGE_CLASS } from '@/features/cart/layout'
import { QuoteErrorState } from '@/features/cart/QuoteErrorState'
import { useCart } from '@/features/cart/useCart'
import { useCouponActions } from '@/features/cart/useCouponActions'
import { QUOTE_ISSUES_MESSAGE, useCartQuote } from '@/features/cart/useCartQuote'
import { sortWallets } from '@/lib/wallets'
import { cn } from '@/lib/utils'
import { pendingAttempt, pendingAttemptSnapshot } from './checkoutDraft'
import { CollectorForm } from './CollectorFormSection'
import { AttemptReview, OrderInProgressAlert, PendingOrderAlert, RecoverPendingOrder, type OrderInProgress } from './PendingAttempt'
import { REQUOTE_FAILED_MESSAGE, VALUES_CHANGED_MESSAGE } from './placeOrder'
import { ReviewDialog } from './ReviewDialog'
import { ReviewStep } from './ReviewStep'
import { ATTEMPT_REVIEW_MESSAGE, attemptLines } from './reviewSource'
import { changeMessages, type SnapshotChange } from './reviewSnapshot'
import { useCheckoutDraft } from './useCheckoutDraft'
import { useCollectorForm } from './useCollectorForm'
import { useNftDetails } from './useNftDetails'
import { usePendingOrder } from './usePendingOrder'
import { useCheckoutOrder } from './usePlaceOrder'
import { useWalletConnection } from './useWalletConnection'
import { WalletStep } from './WalletStep'

export { ATTEMPT_CONFLICT_MESSAGE, ORDER_IN_PROGRESS_MESSAGE, ORDER_LOAD_FAILED_MESSAGE } from './PendingAttempt'

const CONNECT_WALLET_MESSAGE = 'Conecte uma carteira para confirmar.'
export const FORM_INVALID_MESSAGE = 'Revise os campos destacados.'
/** Formulário à esquerda e o resumo (mais largo que o do Carrinho, como no Figma) à direita; empilhado até `lg`. */
const CHECKOUT_GRID_CLASS = 'grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-12'

/**
 * Pagamento (`/checkout`, sob `_authenticated`), no layout do Figma (MYK-1114): o "Perfil do colecionador"
 * (`CollectorForm`, com a carteira cadastrada e a rede) à esquerda; "Seus NFTs", o cupom, o resumo da cotação,
 * "Carteira e rede" (provedor e conexão) e o CTA à direita. "Confirmar compra" valida o formulário no cliente e
 * abre a revisão (`ReviewDialog`, com o diff do que mudou desde o último revisado); confirmar nela recota e compara
 * com o revisado antes de enviar (R3), e o envio
 * é idempotente, com a chave guardada no rascunho (R4). Nenhum valor é somado aqui.
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
      <Breadcrumb aria-label="Trilha de navegação">
        <BreadcrumbList className="text-caption text-foreground font-medium">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Início</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/" hash="catalogo">
                Mercado
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>/</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">Pagamento</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {/* O Figma não mostra um título: a trilha diz onde se está, e o <h1> fica para leitores de tela */}
      <h1 className="sr-only">Pagamento</h1>
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
  const coupon = useCouponActions(useCart())
  const { submitting, resending, source, reviewed, notice, confirm: confirmOrder, markReviewed, resend } = useCheckoutOrder({
    accountId,
    cartItems: cart.items,
    draft,
    quote,
  })
  const attempt = source.kind === 'attempt' ? source.snapshot : undefined
  // Nome e arte dos NFTs do carrinho e da tentativa: com a união, quando a tentativa termina e a lista volta ao
  // carrinho, as artes já estão carregadas (nada pisca em skeleton)
  const nftOf = useNftDetails([...cart.items, ...(attempt?.items ?? [])].map((item) => item.nftId))

  const sortedWallets = wallets.data ? sortWallets(wallets.data) : undefined
  const wallet = useWalletConnection({ draft, drafts, wallets: sortedWallets })
  const { selectedId, selected, connected, connection, provider } = wallet
  const pending = pendingAttempt(draft)

  // Nome de exibição e e-mail vêm da conta até serem editados (editar aqui não altera o Perfil, D6)
  const collector = useCollectorForm({
    draft,
    drafts,
    prefill: { displayName: profile.data?.displayName ?? (profile.isError ? account.name : undefined), email: account.email },
  })
  const [reviewOpen, setReviewOpen] = useState(false)
  // O diff que o diálogo mostra: o que mudou entre o último revisado e a cotação exibida ao abri-lo (R-23)
  const [reviewChanges, setReviewChanges] = useState<readonly SnapshotChange[]>([])
  const ctaRef = useRef<HTMLButtonElement>(null)
  // O último "Confirmar compra" achou erros no formulário; o aviso some quando os erros somem
  const [formInvalid, setFormInvalid] = useState(false)
  const showFormAlert = formInvalid && hasErrors(collector.errors)

  const { quote: quoteData, recalculating, staleAfterError, issues, hasIssues } = quote
  const messages = notice?.kind === 'changed' ? changeMessages(notice.changes) : undefined

  const canConfirm = quote.canCheckout && connected && reviewed !== undefined && !pending
  // Motivos do "Confirmar compra" bloqueado (e o aviso do formulário), ligados a ele por `aria-describedby`
  const issuesId = useId()
  const blockId = useId()
  const connectId = useId()
  const formAlertId = useId()
  const showIssues = !attempt && (hasIssues || notice?.kind === 'blocked')
  const blockReason = quote.block !== undefined && quote.block !== 'issues' ? CHECKOUT_BLOCK_MESSAGE[quote.block] : undefined
  const describedBy =
    [showFormAlert && formAlertId, ...(canConfirm ? [] : [!connected && connectId, showIssues && issuesId, blockReason && blockId])]
      .filter(Boolean)
      .join(' ') || undefined
  // "Confirmar compra" da página: valida o formulário sempre, mesmo com o CTA bloqueado (erros nos campos, foco no
  // primeiro inválido; sem conexão aparecem os dois motivos, R-25), e só com tudo liberado abre a revisão. O envio
  // só sai do "Confirmar compra" do diálogo
  const confirm = () => {
    if (submitting) return
    const formValid = collector.validateAll()
    setFormInvalid(!formValid)
    if (!formValid || !canConfirm || !selectedId) return
    // O diálogo mostra a cotação atual, e ela passa a ser o revisado (o envio compara com ela, R3). O que mudou desde
    // o último revisado (evento, intervalo, cupom aplicado aqui) aparece no diálogo como diff, sem bloquear (R-23)
    setReviewChanges(markReviewed())
    setReviewOpen(true)
  }
  const confirmReviewed = () => {
    setReviewOpen(false)
    // O que bloqueia o envio pode ter surgido com o diálogo aberto (recotação, tentativa em outra aba): o diálogo
    // fecha, o foco volta ao CTA e o motivo aparece ligado a ele
    if (!canConfirm || submitting || !selectedId) return
    confirmOrder(selectedId)
  }

  // O CTA do resumo. Pedido criado e ainda em andamento: o aviso dele (durante o envio que acabou de criar o
  // pedido a página está navegando, e o "Confirmando…" fica). Tentativa pendente: "Tentar de novo", exceto no
  // "Confirmando…" de uma confirmação nova (o `withOrderKey` grava a tentativa antes do POST). Senão, "Confirmar compra"
  const confirmingNew = submitting && !resending
  const cta = orderInProgress !== undefined && !submitting ? 'in-progress' : pending && !confirmingNew ? 'retry' : 'confirm'
  // O diálogo sumiu por fora (tentativa em outra aba, carteira removida): fecha de vez, para não reabrir sozinho
  if (reviewOpen && (cta !== 'confirm' || !selected)) setReviewOpen(false)

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
    <div className={CHECKOUT_GRID_CLASS}>
      <CollectorForm
        form={collector}
        wallets={sortedWallets}
        walletsError={wallets.isError}
        walletsRetrying={wallets.isFetching}
        onRetryWallets={() => void wallets.refetch()}
        selected={selected}
        selectWallet={wallet.selectWallet}
        useOther={wallet.useOther}
        setUseOther={wallet.setUseOther}
        locked={pending !== undefined}
      />

      <aside aria-label="Resumo do pedido" className="flex min-w-0 flex-col gap-5">
        <section aria-labelledby="checkout-seus-nfts" className="flex flex-col gap-3">
          <h2 id="checkout-seus-nfts" className="text-body-lg font-medium">
            Seus NFTs
          </h2>
          {attempt && <p className="text-muted-foreground text-caption">{ATTEMPT_REVIEW_MESSAGE}</p>}
          <ReviewStep lines={lines} />
        </section>

        {/* Com a tentativa na tela, os valores são os do pedido enviado: o cupom vale para a próxima compra */}
        {!attempt && (
          <CouponInput
            collapsible
            status={couponStatus({ submitting: coupon.submitting, couponCode: cart.couponCode, quote: quoteData, quoteError: quote.isError })}
            appliedCode={quoteData?.coupon?.code ?? cart.couponCode}
            onApply={coupon.apply}
            onRemove={coupon.remove}
          />
        )}

        {attempt ? (
          <PriceSummary quote={attempt} />
        ) : quote.isError && !quoteData ? (
          <QuoteErrorState quote={quote} />
        ) : (
          <PriceSummary quote={quoteData} stale={staleMessage !== undefined} staleMessage={staleMessage} staleAction={staleAction} />
        )}

        <WalletStep
          selected={selected}
          connection={connection}
          provider={provider}
          onSelectProvider={wallet.selectProvider}
          onConnect={() => void wallet.connect()}
          onDisconnect={wallet.disconnect}
          locked={pending !== undefined}
        />

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
        {showFormAlert && cta === 'confirm' && <Alert id={formAlertId}>{FORM_INVALID_MESSAGE}</Alert>}

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
            ref={ctaRef}
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

      {selected && (
        <ReviewDialog
          // Só com "Confirmar compra" na tela: uma tentativa pendente nunca abre a revisão ("Tentar de novo")
          open={reviewOpen && cta === 'confirm'}
          onOpenChange={setReviewOpen}
          onConfirm={confirmReviewed}
          returnFocusTo={ctaRef}
          collector={collector.values}
          wallet={selected}
          provider={provider}
          lines={lines}
          quote={quoteData}
          changes={reviewChanges}
        />
      )}
    </div>
  )
}

function Alert({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="text-destructive text-caption inline-flex items-start gap-1.5">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  )
}

function CheckoutSkeleton() {
  return (
    <div aria-busy className={CHECKOUT_GRID_CLASS}>
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
