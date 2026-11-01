import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CircleX, LoaderCircle, MailOpen, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { nftDetailQuery } from '@/api/nfts'
import { walletsQuery } from '@/api/wallets'
import type { Id, Nft, Order } from '@/contracts'
import { buttonVariants } from '@/components/ui/button'
import { checkoutDraftStore } from '@/features/checkout/checkoutDraft'
import { cn } from '@/lib/utils'
import { shortAddress } from '@/lib/wallets'
import { OrderReceipt } from './OrderReceipt'
import { applyOrderOutcome } from './orderStatus'

const TITLE: Record<Order['status'], string> = {
  pending: 'Aguardando confirmação da rede',
  confirmed: 'Seus NFTs agora estão na sua carteira',
  declined: 'Pagamento recusado',
}

/**
 * Confirmação (`/orders/$orderId`) no painel "Thank you" do Figma: centralizado, com o X que volta ao Início e a
 * faixa laranja na base. Continua sendo a página da rota (sobrevive a refresh, acesso direto e retomada de pedido
 * pendente); só o visual é de modal. `pending` mostra o pedido e a chave em evidência, `confirmed` o recibo do
 * snapshot e `declined` "Voltar ao pagamento". O foco vai para o título a cada mudança de estado.
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

  const confirmed = order.status === 'confirmed'
  // Só a arte vem do catálogo (a imagem não é valor); o resto do recibo é o snapshot do pedido
  const details = useQueries({
    queries: confirmed ? order.receipt.items.map((item) => nftDetailQuery(item.nftId)) : [],
  })
  const nfts: Partial<Record<Id, Nft>> = {}
  for (const detail of details) if (detail.data) nfts[detail.data.id] = detail.data
  const wallets = useQuery({ ...walletsQuery(accountId), enabled: confirmed })
  const wallet = wallets.data?.find((w) => w.id === order.walletId)

  return (
    <div className="mx-auto w-full max-w-[36.25rem] px-4 pt-4 pb-8 md:py-12">
      <article className="bg-card border-primary relative flex flex-col border-b-8 pb-8">
        <Link
          to="/"
          aria-label="Fechar e voltar ao Início"
          className={buttonVariants({
            variant: 'ghost',
            size: 'icon',
            className: 'text-text-accent hover:text-text-accent absolute top-1 right-1 size-11 rounded-full',
          })}
        >
          <X aria-hidden className="size-5" />
        </Link>

        <header className="flex flex-col items-center gap-3 px-12 pt-8 pb-6 text-center">
          {order.status === 'pending' && (
            <LoaderCircle aria-hidden className="text-text-accent size-14 animate-spin motion-reduce:animate-none" />
          )}
          {/* Envelope "THANK YOU" do Figma: o `MailOpen` fica no lugar até o asset ser exportado ("Substituição de assets") */}
          {confirmed && <MailOpen aria-hidden strokeWidth={1.5} className="text-text-accent size-16" />}
          {order.status === 'declined' && <CircleX aria-hidden strokeWidth={1.5} className="text-destructive size-14" />}
          <h1 ref={headingRef} tabIndex={-1} className="text-text-accent text-body-lg font-bold outline-none">
            {TITLE[order.status]}
          </h1>
          <div role="status" aria-live="polite" className="text-muted-foreground text-caption">
            {order.status === 'pending' && <p>Seu pedido foi enviado. A rede está processando o pagamento; não feche esta página.</p>}
            {confirmed && <p>Pagamento confirmado na rede. Os NFTs comprados saíram do seu carrinho.</p>}
            {order.status === 'declined' && <p>A rede recusou o pagamento. Nada foi cobrado; você pode tentar de novo.</p>}
          </div>
        </header>

        {confirmed ? (
          <>
            <OrderReceipt
              order={order}
              nfts={nfts}
              walletLabel={wallet ? wallet.label || shortAddress(wallet.address) : undefined}
            />
            <OrderKeys order={order} className="px-4 pt-4 text-center sm:px-12" />
          </>
        ) : (
          <div className="flex flex-col items-center gap-6 px-4 sm:px-12">
            {/* Ainda não há transação: o pedido e a chave ficam em evidência */}
            <dl className="border-primary text-caption grid w-full gap-1 border-y py-3 sm:grid-cols-[auto_1fr] sm:gap-x-4">
              <dt className="text-text-accent font-bold">Pedido</dt>
              <dd className="break-all font-mono">{order.id}</dd>
              <dt className="text-text-accent font-bold">Chave do pedido</dt>
              <dd className="break-all font-mono">{order.idempotencyKey}</dd>
            </dl>
            {order.status === 'declined' && (
              <Link to="/checkout" className={buttonVariants({ size: 'lg', className: 'text-body font-bold' })}>
                Voltar ao pagamento
              </Link>
            )}
          </div>
        )}
      </article>
    </div>
  )
}

/** "Pedido … · Chave …" discreto abaixo do botão do explorador: o recibo continua exibindo a chave do pedido. */
function OrderKeys({ order, className }: { order: Order; className?: string }) {
  return (
    <p className={cn('text-muted-foreground text-caption break-all', className)}>
      Pedido <span className="font-mono">{order.id}</span> · Chave <span className="font-mono">{order.idempotencyKey}</span>
    </p>
  )
}
