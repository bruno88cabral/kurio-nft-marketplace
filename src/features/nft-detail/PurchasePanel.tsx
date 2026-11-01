import { Ban, CircleAlert, Info, Share2 } from 'lucide-react'
import { useState } from 'react'
import type { Nft, NftEditionKind } from '@/contracts'
import { EditionChips, OutOfScopeAction, QuantityStepper } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { AddToCartButton } from '@/features/cart/AddToCartButton'
import { NftFavoriteButton } from '@/features/favorites/FavoriteButton'
import { editionLabel } from '@/lib/editions'
import { cn } from '@/lib/utils'
import type { PurchaseSelection } from './usePurchaseSelection'

export interface PurchasePanelProps {
  nft: Pick<Nft, 'id' | 'name' | 'editions'>
  /** Edição e quantidade escolhidas (`usePurchaseSelection`, compartilhada com a `MobilePurchaseBar`). */
  selection: PurchaseSelection
  onEditionChange: (kind: NftEditionKind) => void
  className?: string
}

/**
 * Área de compra: edição (chips, escolha na URL), quantidade (1..available da edição), carrinho
 * e compartilhar (fora de escopo neste milestone, "Em breve") e favoritar (funcional).
 * No mobile o "Adicionar ao carrinho" sai daqui e fica na barra fixa (`MobilePurchaseBar`).
 * A seleção (edição + quantidade) vem da rota, que remonta com `key={nft.id}` ao trocar de NFT.
 */
export function PurchasePanel({ nft, selection, onEditionChange, className }: PurchasePanelProps) {
  const { edition, unavailable, quantity, setQuantity, soldOut } = selection
  // 409 do carrinho: vale só para a edição e a quantidade em que ocorreu (muda a escolha, o aviso some)
  const [stockError, setStockError] = useState<{ key: string; message: string } | null>(null)
  const selectionKey = `${edition?.kind}:${quantity}`
  const stockMessage = stockError?.key === selectionKey ? stockError.message : null

  return (
    <section aria-labelledby="nft-compra" data-slot="purchase-panel" className={cn('flex flex-col gap-5', className)}>
      <h2 id="nft-compra" className="sr-only">
        Comprar
      </h2>

      {soldOut && (
        <p
          className="border-border-soft bg-muted text-foreground inline-flex items-center gap-2 self-start rounded-md border px-3 py-2 text-caption font-bold uppercase"
        >
          <Ban aria-hidden className="size-4" />
          Esgotado
        </p>
      )}

      <div className="flex flex-col gap-2">
        <span aria-hidden className="text-caption font-medium">
          Edição
        </span>
        <EditionChips
          editions={nft.editions}
          value={edition?.kind}
          onValueChange={onEditionChange}
          disabled={soldOut}
          label="Edição"
        />
        {unavailable && !soldOut && edition && (
          <p role="status" className="text-text-accent text-caption inline-flex items-start gap-1.5">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              Edição indisponível. Mostrando a edição {editionLabel(edition.kind)}.
            </span>
          </p>
        )}
        {edition && (
          <p className="text-muted-foreground text-tiny">
            {edition.available} de {edition.total} disponíveis
          </p>
        )}
      </div>

      <QuantityStepper
        value={quantity}
        onChange={setQuantity}
        min={1}
        max={edition?.available ?? 1}
        disabled={soldOut || !edition}
        showLabel
        className="self-start"
      />

      <div className="flex flex-wrap items-center gap-2">
        {soldOut ? (
          <Button type="button" size="lg" disabled className="hidden md:inline-flex">
            <Ban aria-hidden />
            Esgotado
          </Button>
        ) : (
          edition && (
            <AddToCartButton
              item={{ nftId: nft.id, edition: edition.kind, quantity }}
              available={edition.available}
              onStockError={(message) => setStockError(message === null ? null : { key: selectionKey, message })}
              size="lg"
              className="hidden md:inline-flex"
            />
          )
        )}
        <NftFavoriteButton nft={nft} className="h-10" />
        <OutOfScopeAction variant="outline" size="icon-lg" label="Compartilhar">
          <Share2 aria-hidden />
        </OutOfScopeAction>
      </div>
      {stockMessage && (
        <p role="alert" className="text-destructive text-caption hidden items-center gap-1.5 md:inline-flex">
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
          {stockMessage}
        </p>
      )}
    </section>
  )
}
