import { Ban, CircleAlert, Info, Mail } from 'lucide-react'
import { useState } from 'react'
import type { Nft, NftEditionKind } from '@/contracts'
import { EditionChips, OutOfScopeAction, QuantityStepper, SocialIcon } from '@/components/kurio'
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

/** "COMPRAR" do Figma: laranja sólido e em caixa alta (o nome acessível é "Comprar"). */
const BUY_CLASS = 'h-11 px-8 text-body font-bold uppercase'

/**
 * Área de compra (Figma desktop): "Edição:" em pílulas, quantidade com botões laranja redondos e,
 * na mesma linha, "COMPRAR", o carrinho (só ícone, R-27: adiciona sem sair) e "Favoritar". A seleção (edição + quantidade) vem da rota, que
 * remonta com `key={nft.id}` ao trocar de NFT.
 *
 * No mobile a quantidade, o "Comprar NFT" e o carrinho ficam na barra fixa (`MobilePurchaseBar`)
 * e o favorito no topo, sobre a arte; aqui fica só a edição.
 */
export function PurchasePanel({ nft, selection, onEditionChange, className }: PurchasePanelProps) {
  const { edition, unavailable, quantity, setQuantity, soldOut } = selection
  // 409 do carrinho: vale só para a edição e a quantidade em que ocorreu (muda a escolha, o aviso some)
  const [stockError, setStockError] = useState<{ key: string; message: string } | null>(null)
  const selectionKey = `${edition?.kind}:${quantity}`
  const stockMessage = stockError?.key === selectionKey ? stockError.message : null

  return (
    <section aria-labelledby="nft-compra" data-slot="purchase-panel" className={cn('flex flex-col gap-4', className)}>
      <h2 id="nft-compra" className="sr-only">
        Comprar
      </h2>

      {soldOut && (
        <p className="border-border-soft bg-muted text-foreground text-caption inline-flex items-center gap-2 self-start rounded-md border px-3 py-2 font-bold uppercase">
          <Ban aria-hidden className="size-4" />
          Esgotado
        </p>
      )}

      <div className="flex flex-col gap-2">
        <span aria-hidden className="text-body font-bold">
          Edição:
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
            <span>Edição indisponível. Mostrando a edição {editionLabel(edition.kind)}.</span>
          </p>
        )}
        {edition && (
          <p className="text-muted-foreground text-caption">
            {edition.available} de {edition.total} disponíveis
          </p>
        )}
      </div>

      <div className="hidden flex-col items-start gap-3 md:flex lg:flex-row lg:gap-4">
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          min={1}
          max={edition?.available ?? 1}
          disabled={soldOut || !edition}
          appearance="accent"
        />
        <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
          {soldOut ? (
            <Button type="button" size="lg" disabled className={BUY_CLASS}>
              <Ban aria-hidden />
              Esgotado
            </Button>
          ) : (
            edition && (
              <AddToCartButton
                intent="buy"
                item={{ nftId: nft.id, edition: edition.kind, quantity }}
                available={edition.available}
                onStockError={(message) => setStockError(message === null ? null : { key: selectionKey, message })}
                size="lg"
                className={BUY_CLASS}
              />
            )
          )}
          {/* Desvio do Figma (R-27): adicionar sem sair do Detalhe, como o carrinho redondo da barra
              mobile (mesmo toast; o 409 também vira toast) */}
          {!soldOut && edition && (
            <AddToCartButton
              iconOnly
              item={{ nftId: nft.id, edition: edition.kind, quantity }}
              available={edition.available}
              className="border-primary text-text-accent hover:bg-muted size-11 bg-transparent"
            />
          )}
          <NftFavoriteButton nft={nft} className="h-11" />
        </div>
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

/** "Compartilhar este NFT:" com LinkedIn, e-mail e Twitter (Figma desktop), todos "Em breve". */
export function ShareNft({ className }: { className?: string }) {
  // 44 px no tablet (toque); 36 a partir de `lg`
  const icon = 'text-foreground size-11 rounded-md opacity-100 lg:size-9'
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <span className="text-body mr-1 font-bold">Compartilhar este NFT:</span>
      <OutOfScopeAction variant="ghost" size="icon" label="Compartilhar no LinkedIn" className={icon}>
        <SocialIcon name="LinkedIn" className="size-4" />
      </OutOfScopeAction>
      <OutOfScopeAction variant="ghost" size="icon" label="Compartilhar por e-mail" className={icon}>
        <Mail aria-hidden className="size-4" />
      </OutOfScopeAction>
      <OutOfScopeAction variant="ghost" size="icon" label="Compartilhar no Twitter" className={icon}>
        <SocialIcon name="Twitter" className="size-4" />
      </OutOfScopeAction>
    </div>
  )
}
