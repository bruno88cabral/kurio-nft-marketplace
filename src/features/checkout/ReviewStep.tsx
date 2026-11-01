import { CircleAlert } from 'lucide-react'
import type { CartItem, EthAmount, Nft, QuoteIssue } from '@/contracts'
import { PriceTag } from '@/components/kurio'
import { Skeleton } from '@/components/ui/skeleton'
import { editionLabel } from '@/lib/editions'
import { nftArtSize } from '@/lib/nftArt'
import { lineKey } from '@/features/cart/cartView'

const ISSUE_TEXT: Record<QuoteIssue['kind'], string> = {
  unavailable: 'Indisponível na quantidade escolhida.',
  price_changed: 'Preço alterado.',
}

export interface ReviewLine {
  item: CartItem
  nft: Nft | undefined
  /** Preço unitário da cotação (nunca multiplicado aqui). */
  unitPrice: EthAmount | undefined
  issue?: QuoteIssue['kind']
  /** Mensagem da revalidação para esta linha (409 do pedido ou diferença da recotação). */
  message?: string
}

/** Etapa "Revisão": os itens com o preço unitário da cotação e o aviso por linha. */
export function ReviewStep({ lines }: { lines: readonly ReviewLine[] }) {
  return (
    <ul className="flex flex-col">
      {lines.map(({ item, nft, unitPrice, issue, message }) => {
        const art = nft ? nftArtSize(nft.imageUrl) : undefined
        const warning = message ?? (issue ? ISSUE_TEXT[issue] : undefined)
        return (
          <li key={lineKey(item)} className="border-border flex gap-3 border-b py-3 first:pt-0 last:border-b-0">
            <div className="bg-muted size-16 shrink-0 overflow-hidden rounded-md">
              {nft && art ? (
                <img
                  src={nft.imageUrl}
                  alt=""
                  width={art.width}
                  height={art.height}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              ) : (
                <Skeleton className="size-full motion-reduce:animate-none" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-body truncate font-medium">{nft?.name ?? item.nftId}</p>
                {unitPrice ? <PriceTag price={unitPrice} size="sm" /> : <Skeleton className="h-4 w-16 motion-reduce:animate-none" />}
              </div>
              <p className="text-muted-foreground text-caption">
                Edição {editionLabel(item.edition)} · {item.quantity} {item.quantity === 1 ? 'unidade' : 'unidades'}
                {item.quantity > 1 && <span> · preço por unidade</span>}
              </p>
              {warning && (
                <p role="alert" className="text-destructive text-caption inline-flex items-start gap-1.5">
                  <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {warning}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
