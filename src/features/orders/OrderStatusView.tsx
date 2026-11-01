import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Id, Order } from '@/contracts'
import { buttonVariants } from '@/components/ui/button'
import { checkoutDraftStore } from '@/features/checkout/checkoutDraft'
import { OrderReceipt } from './OrderReceipt'
import { applyOrderOutcome } from './orderStatus'

const TITLE: Record<Order['status'], string> = {
  pending: 'Aguardando confirmação da rede',
  confirmed: 'Pedido confirmado',
  declined: 'Pagamento recusado',
}

/**
 * Confirmação (`/orders/$orderId`): `pending` com a chave do pedido, `confirmed` com o recibo do snapshot e
 * `declined` com "Voltar ao pagamento". O foco vai para o título a cada mudança de estado.
 */
export function OrderStatusView({ accountId, order }: { accountId: Id; order: Order }) {
  const queryClient = useQueryClient()
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Foco no título ao abrir e a cada mudança de estado (o botão que tinha o foco saiu com o Pagamento)
  useEffect(() => {
    headingRef.current?.focus()
  }, [order.status])

  // Idempotente; o `structuralSharing` mantém a mesma referência quando o polling não traz mudança
  useEffect(() => {
    applyOrderOutcome(queryClient, accountId, order, checkoutDraftStore(accountId))
  }, [queryClient, accountId, order])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-4 pb-8 md:px-6 md:py-8">
      <header className="flex flex-col gap-2">
        <h1 ref={headingRef} tabIndex={-1} className="text-heading inline-flex items-center gap-3 outline-none">
          {order.status === 'pending' && (
            <LoaderCircle aria-hidden className="text-muted-foreground size-6 animate-spin motion-reduce:animate-none" />
          )}
          {order.status === 'confirmed' && <CircleCheck aria-hidden className="text-text-accent size-6" />}
          {order.status === 'declined' && <CircleX aria-hidden className="text-destructive size-6" />}
          {TITLE[order.status]}
        </h1>
        <div role="status" aria-live="polite" className="text-muted-foreground text-body">
          {order.status === 'pending' && <p>Seu pedido foi enviado. A rede está processando o pagamento; não feche esta página.</p>}
          {order.status === 'confirmed' && <p>Pagamento confirmado na rede. Os NFTs comprados saíram do seu carrinho.</p>}
          {order.status === 'declined' && <p>A rede recusou o pagamento. Nada foi cobrado; você pode tentar de novo.</p>}
        </div>
      </header>

      <dl className="text-caption grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="text-muted-foreground">Pedido</dt>
        <dd className="break-all font-mono">{order.id}</dd>
        <dt className="text-muted-foreground">Chave do pedido</dt>
        <dd className="break-all font-mono">{order.idempotencyKey}</dd>
      </dl>

      {order.status === 'confirmed' && <OrderReceipt order={order} />}

      {order.status === 'declined' && (
        <Link to="/checkout" className={buttonVariants({ size: 'lg', className: 'self-start' })}>
          Voltar ao pagamento
        </Link>
      )}
      {order.status === 'confirmed' && (
        <Link to="/" hash="catalogo" className={buttonVariants({ variant: 'outline', className: 'self-start' })}>
          Continuar comprando
        </Link>
      )}
    </div>
  )
}
