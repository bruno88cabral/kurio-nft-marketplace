import { CircleAlert } from 'lucide-react'
import type { CartItem, EthAmount, Nft, QuoteIssue } from '@/contracts'
import { PriceTag } from '@/components/kurio'
import { Skeleton } from '@/components/ui/skeleton'
import { editionLabel } from '@/lib/editions'
import { formatEthLabel, mulEth } from '@/lib/eth'
import { nftArtSize } from '@/lib/nftArt'
import { lineKey } from '@/features/cart/cartView'

const ISSUE_TEXT: Record<QuoteIssue['kind'], string> = {
  unavailable: 'Indisponível na quantidade escolhida.',
  price_changed: 'Preço alterado.',
}

export interface ReviewLine {
  item: CartItem
  nft: Nft | undefined
  /** Preço unitário da cotação. O total da linha (× quantidade) é só exibição; nada é somado entre linhas. */
  unitPrice: EthAmount | undefined
  issue?: QuoteIssue['kind']
  /** Mensagem da revalidação para esta linha (409 do pedido ou diferença da recotação). */
  message?: string
}

/**
 * "Seus NFTs" (Figma do Pagamento): cabeçalho "NFTs / Subtotal" e, por linha, arte, nome, edição, "(x N)" e o
 * subtotal da linha (`mulEth(unitPrice, quantity)`, só para exibir, decisão do humano). Os valores do resumo
 * continuam vindo da cotação. `announce={false}` (diálogo de revisão) mostra os avisos por linha sem `role="alert"`,
 * para o leitor de tela não anunciá-los de novo.
 */
export function ReviewStep({ lines, announce = true }: { lines: readonly ReviewLine[]; announce?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden className="border-border text-caption flex justify-between border-b pb-2 font-medium">
        <span>NFTs</span>
        <span>Subtotal</span>
      </div>
      <ul className="flex flex-col">
        {lines.map(({ item, nft, unitPrice, issue, message }) => {
          const art = nft ? nftArtSize(nft.imageUrl) : undefined
          const warning = message ?? (issue ? ISSUE_TEXT[issue] : undefined)
          return (
            <li key={lineKey(item)} className="border-border flex gap-3 border-b py-3 last:border-b-0">
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
                  <Skeleton className="size-full" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-body truncate font-medium">{nft?.name ?? item.nftId}</p>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="text-muted-foreground text-caption">(x {item.quantity})</span>
                    {unitPrice ? (
                      <PriceTag price={mulEth(unitPrice, item.quantity)} size="sm" tone="accent" />
                    ) : (
                      <Skeleton className="h-4 w-16" />
                    )}
                  </span>
                </div>
                <p className="text-muted-foreground text-caption">
                  Edição {editionLabel(item.edition)}
                  {item.quantity > 1 && unitPrice && <span> · {formatEthLabel(unitPrice)} cada</span>}
                </p>
                {warning && (
                  <p role={announce ? 'alert' : undefined} className="text-destructive text-caption inline-flex items-start gap-1.5">
                    <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                    {warning}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
