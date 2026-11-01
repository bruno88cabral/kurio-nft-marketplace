import { Link } from '@tanstack/react-router'
import { CircleAlert, LoaderCircle, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { ApiError, type CartItem, type EthAmount, type Nft, type QuoteIssue } from '@/contracts'
import { PriceTag, QuantityStepper } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { editionLabel } from '@/lib/editions'
import { nftArtSize } from '@/lib/nftArt'
import { cn } from '@/lib/utils'

export const LINE_FAILURE_MESSAGE = 'Não foi possível atualizar o carrinho.'

const ISSUE_LABEL: Record<QuoteIssue['kind'], string> = {
  unavailable: 'Indisponível',
  price_changed: 'Preço alterado',
}

export interface CartLineProps {
  item: CartItem
  /** Detalhe do NFT; `undefined` enquanto carrega ou se a busca falhou (`nftFailed`). */
  nft: Nft | undefined
  nftFailed?: boolean
  /** Preço unitário a mostrar: o da cotação quando há (logado), senão o do catálogo. Nunca é multiplicado aqui. */
  unitPrice: EthAmount | undefined
  issue?: QuoteIssue['kind']
  onQuantityChange: (quantity: number) => Promise<void>
  onRemove: () => Promise<void>
}

/**
 * Linha do carrinho: arte, nome (link para o Detalhe com a edição), edição, stepper (1..`available`) e
 * "Remover". O envio trava só esta linha (`aria-busy`); o 409 de estoque aparece nela (`role="alert"`).
 */
export function CartLine({ item, nft, nftFailed = false, unitPrice, issue, onQuantityChange, onRemove }: CartLineProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? e.message : LINE_FAILURE_MESSAGE)
    } finally {
      setBusy(false)
    }
  }

  const available = nft?.editions.find((e) => e.kind === item.edition)?.available
  const name = nft?.name ?? (nftFailed ? 'NFT indisponível' : undefined)
  const art = nft ? nftArtSize(nft.imageUrl) : undefined
  const editionText = `Edição ${editionLabel(item.edition)}`

  return (
    <li
      data-slot="cart-line"
      aria-busy={busy || undefined}
      className={cn('border-border flex gap-3 border-b py-4 first:pt-0 last:border-b-0 sm:gap-4', busy && 'opacity-70')}
    >
      <div className="bg-muted size-20 shrink-0 overflow-hidden rounded-lg sm:size-24">
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
        ) : nftFailed ? null : (
          <Skeleton className="size-full motion-reduce:animate-none" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {nft ? (
              <Link
                to="/nfts/$nftId"
                params={{ nftId: nft.id }}
                search={{ edition: item.edition }}
                className="text-body hover:text-text-accent focus-visible:ring-ring truncate rounded-sm font-bold outline-none focus-visible:ring-3"
              >
                {nft.name}
              </Link>
            ) : name ? (
              <p className="text-body font-bold">{name}</p>
            ) : (
              <Skeleton className="h-5 w-40 motion-reduce:animate-none" />
            )}
            <p className="text-muted-foreground text-caption">{editionText}</p>
          </div>
          {unitPrice && (
            <span className="flex shrink-0 flex-col items-end">
              <PriceTag price={unitPrice} size="sm" />
              <span className="text-muted-foreground text-tiny">cada</span>
            </span>
          )}
        </div>

        {issue && (
          <p className="text-destructive text-caption inline-flex items-center gap-1.5 font-medium">
            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
            {ISSUE_LABEL[issue]}
            {issue === 'unavailable' && <span className="text-muted-foreground font-normal">· sem estoque suficiente</span>}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <QuantityStepper
            size="sm"
            value={item.quantity}
            onChange={(quantity) => void run(() => onQuantityChange(quantity))}
            min={1}
            max={available ?? item.quantity}
            // Sem `disabled` durante o envio: o foco não pode sumir do campo; `run` ignora o segundo envio
            disabled={available === undefined}
            label={name ? `Quantidade de ${name}, ${editionText}` : 'Quantidade'}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            // O texto visível ("Remover") é o começo do nome acessível (WCAG 2.5.3)
            aria-label={`Remover ${name ?? 'item'}, ${editionText}`}
            aria-disabled={busy || undefined}
            onClick={() => void run(onRemove)}
          >
            {busy ? (
              <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Trash2 aria-hidden />
            )}
            Remover
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-destructive text-caption inline-flex items-center gap-1.5">
            <CircleAlert aria-hidden className="size-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </li>
  )
}
