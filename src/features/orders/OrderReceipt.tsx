import { ExternalLink } from 'lucide-react'
import type { Order } from '@/contracts'
import { PriceSummary } from '@/components/kurio'
import { editionLabel } from '@/lib/editions'
import { formatEthLabel } from '@/lib/eth'
import { networkLabel, shortAddress } from '@/lib/wallets'

/**
 * Recibo do pedido confirmado. Tudo vem do `order.receipt` (snapshot do que foi cobrado), nunca do
 * catálogo atual: mudar o preço do NFT depois não muda o recibo.
 */
export function OrderReceipt({ order }: { order: Order }) {
  const { receipt } = order
  return (
    <section aria-labelledby="recibo" className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4">
      <h2 id="recibo" className="text-body-lg font-medium">
        Recibo
      </h2>
      <ul className="flex flex-col gap-2">
        {receipt.items.map((item) => (
          <li key={`${item.nftId}:${item.edition}`} className="flex items-start justify-between gap-4 text-body">
            <span className="min-w-0">
              <span className="block truncate font-medium">{item.name}</span>
              <span className="text-muted-foreground text-caption">
                Edição {editionLabel(item.edition)} · {item.quantity} × {formatEthLabel(item.unitPrice)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <PriceSummary quote={receipt} />
      {order.txHash && (
        <dl className="text-caption grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
          <dt className="text-muted-foreground">Rede</dt>
          <dd>{networkLabel(order.network)}</dd>
          <dt className="text-muted-foreground">Transação</dt>
          <dd className="break-all font-mono" title={order.txHash}>
            {shortAddress(order.txHash, 8)}
          </dd>
        </dl>
      )}
      {order.explorerUrl && (
        <a
          href={order.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary text-body inline-flex items-center gap-1.5 self-start underline-offset-4 hover:underline"
        >
          Ver transação no explorador
          <ExternalLink aria-hidden className="size-4" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      )}
    </section>
  )
}
