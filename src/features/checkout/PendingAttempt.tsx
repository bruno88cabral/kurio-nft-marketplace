import { Link } from '@tanstack/react-router'
import { LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ApiError, type Id } from '@/contracts'
import { PriceSummary } from '@/components/kurio'
import { Button, buttonVariants } from '@/components/ui/button'
import { BLOCKED_CTA_CLASS, GRID_CLASS } from '@/features/cart/layout'
import { cn } from '@/lib/utils'
import type { AttemptSnapshot } from './attemptSnapshot'
import { ReviewSection } from './CheckoutStep'
import { ORDER_FAILED_MESSAGE, TRANSIENT_ORDER_MESSAGE } from './placeOrder'
import { attemptLines } from './reviewSource'
import { useNftDetails } from './useNftDetails'
import type { PendingOrderState } from './usePendingOrder'
import { usePlaceOrder, type SettledOutcome } from './usePlaceOrder'

export const ORDER_IN_PROGRESS_MESSAGE = 'Seu pedido anterior ainda está em andamento.'
export const ORDER_LOAD_FAILED_MESSAGE = 'Não foi possível consultar o pedido anterior.'
/** Toast do 409 no "Tentar de novo" com o carrinho vazio: a tentativa sai e a página volta ao /cart. */
export const ATTEMPT_CONFLICT_MESSAGE = 'O pedido não foi feito: os valores ou o estoque mudaram desde o envio.'

export type OrderInProgress = Extract<PendingOrderState, { kind: 'in-progress' }>

/** Só o "Tentar de novo" da tentativa gravada (carrinho já vazio). */
export function RecoverPendingOrder({ accountId }: { accountId: Id }) {
  const { submitting, resend } = usePlaceOrder(accountId)

  // 409 e `fatal` descartam a tentativa: sem ela e com o carrinho vazio a página volta ao /cart, então o motivo
  // vai no toast. `transient` mantém o aviso
  const handle = (outcome: SettledOutcome) => {
    if (outcome.kind === 'fatal') toast.error(outcome.error instanceof ApiError ? outcome.error.message : ORDER_FAILED_MESSAGE)
    if (outcome.kind === 'items' || outcome.kind === 'quote') toast.error(ATTEMPT_CONFLICT_MESSAGE, { description: outcome.message })
  }

  return <PendingOrderAlert submitting={submitting} onResend={() => resend(handle)} />
}

/**
 * Carrinho vazio com tentativa pendente e snapshot: a lista e os valores do que "Tentar de novo" compra, acima do
 * aviso (`children`). Só exibe: o envio continua com a mesma chave e o mesmo corpo (R4).
 */
export function AttemptReview({ snapshot, children }: { snapshot: AttemptSnapshot; children: ReactNode }) {
  const nftOf = useNftDetails(snapshot.items.map((item) => item.nftId))
  return (
    <div className={GRID_CLASS}>
      <ReviewSection number={3} title="Revisão" attempt lines={attemptLines(snapshot, nftOf)} />
      <aside aria-label="Resumo do pedido" className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4 lg:sticky lg:top-24">
        <PriceSummary title="Resumo" quote={snapshot} />
        {children}
      </aside>
    </div>
  )
}

/**
 * Tentativa com pedido criado (`orderId` no rascunho) e ainda sem estado final: nada a reenviar e nenhuma chave
 * nova enquanto ele não termina. O `order.updated` (ou a consulta do `usePendingOrder`) libera o checkout. Se a
 * consulta falha, "Tentar novamente" consulta de novo; a tentativa não é descartada (o pedido existe).
 */
export function OrderInProgressAlert({ state }: { state: OrderInProgress }) {
  const { orderId, loadFailed, retrying, retry } = state
  return (
    <div role="status" className="border-border flex flex-col gap-2 rounded-md border p-3">
      <p className="text-body inline-flex items-start gap-2 font-medium">
        <LoaderCircle aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none" />
        {ORDER_IN_PROGRESS_MESSAGE}
      </p>
      <p className="text-muted-foreground text-caption">
        A rede ainda está processando o pagamento. Quando ele terminar, você pode confirmar uma nova compra.
      </p>
      {loadFailed && (
        <div className="flex flex-col gap-2">
          <p className="text-destructive text-caption inline-flex items-start gap-1.5">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {ORDER_LOAD_FAILED_MESSAGE}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn('self-start', BLOCKED_CTA_CLASS)}
            aria-busy={retrying || undefined}
            aria-disabled={retrying || undefined}
            onClick={() => !retrying && retry()}
          >
            {retrying ? <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" /> : <RefreshCw aria-hidden />}
            Tentar novamente
          </Button>
        </div>
      )}
      <Link to="/orders/$orderId" params={{ orderId }} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'self-start')}>
        Acompanhar o pedido
      </Link>
    </div>
  )
}

/** O botão "Confirmar compra" sai e este entra no lugar: o foco vai para "Tentar de novo" (não cai no `<body>`). */
export function PendingOrderAlert({ submitting, onResend }: { submitting: boolean; onResend: () => void }) {
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
