import { Ban, Info, Share2, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import type { Nft, NftEditionKind } from '@/contracts'
import { EditionChips, OutOfScopeAction, QuantityStepper } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { NftFavoriteButton } from '@/features/favorites/FavoriteButton'
import { editionLabel, isSoldOut } from '@/lib/editions'
import { cn } from '@/lib/utils'
import { clampEditionQuantity, resolveEdition } from './edition'

export interface PurchasePanelProps {
  nft: Pick<Nft, 'id' | 'name' | 'editions'>
  /** Edição pedida em `?edition=` (pode não existir no NFT ou estar esgotada). */
  requestedEdition: NftEditionKind | undefined
  onEditionChange: (kind: NftEditionKind) => void
  className?: string
}

/**
 * Área de compra: edição (chips, escolha na URL), quantidade (1..available da edição), carrinho
 * e compartilhar (fora de escopo neste milestone, "Em breve") e favoritar (funcional).
 * No mobile o "Adicionar ao carrinho" sai daqui e fica na barra fixa (`MobilePurchaseBar`).
 * Remonte com `key={nft.id}` ao trocar de NFT (a quantidade é estado local).
 */
export function PurchasePanel({ nft, requestedEdition, onEditionChange, className }: PurchasePanelProps) {
  const soldOut = isSoldOut(nft.editions)
  const { edition, unavailable } = resolveEdition(nft, requestedEdition)
  const [rawQuantity, setRawQuantity] = useState(1)
  // Clamp derivado (sem efeito): trocar para uma edição com menos unidades limita na hora
  const quantity = clampEditionQuantity(edition, rawQuantity)

  return (
    <section aria-labelledby="nft-compra" data-slot="purchase-panel" className={cn('flex flex-col gap-5', className)}>
      <h2 id="nft-compra" className="sr-only">
        Comprar
      </h2>

      {soldOut && (
        <p
          role="status"
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
        onChange={setRawQuantity}
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
          <OutOfScopeAction variant="default" size="lg" className="hidden md:inline-flex">
            <ShoppingCart aria-hidden />
            Adicionar ao carrinho
          </OutOfScopeAction>
        )}
        <NftFavoriteButton nft={nft} className="h-10" />
        <OutOfScopeAction variant="outline" size="icon-lg" label="Compartilhar">
          <Share2 aria-hidden />
        </OutOfScopeAction>
      </div>
    </section>
  )
}
