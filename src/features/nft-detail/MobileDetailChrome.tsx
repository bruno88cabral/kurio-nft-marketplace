import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { Ban, ChevronLeft } from 'lucide-react'
import type { Nft } from '@/contracts'
import { PriceTag, QuantityStepper } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { AddToCartButton } from '@/features/cart/AddToCartButton'
import { NftFavoriteButton } from '@/features/favorites/FavoriteButton'
import { cn } from '@/lib/utils'
import type { PurchaseSelection } from './usePurchaseSelection'

/** Botão redondo de 44 px sobre o fundo `#241612` (voltar, carrinho). */
const ROUND_CLASS =
  'bg-card border-border-soft text-text-accent hover:bg-muted focus-visible:ring-offset-card size-11 rounded-full border focus-visible:ring-offset-2'

/**
 * Topo do Detalhe no mobile (Figma): botões redondos de voltar (esquerda) e favoritar (direita)
 * acima da arte; o header do site não aparece nesta tela (`staticData.hideMobileChrome`).
 * Voltar usa o histórico quando a navegação começou dentro do app; num acesso direto (sem
 * histórico) vai para o Início.
 */
export function MobileDetailTopBar({ nft, className }: { nft: Pick<Nft, 'id' | 'name'>; className?: string }) {
  const router = useRouter()
  const navigate = useNavigate()
  const canGoBack = useCanGoBack()
  return (
    <div data-slot="detail-top-bar" className={cn('flex items-center justify-between md:hidden', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Voltar"
        className={ROUND_CLASS}
        onClick={() => (canGoBack ? router.history.back() : void navigate({ to: '/' }))}
      >
        <ChevronLeft aria-hidden className="size-6" />
      </Button>
      <NftFavoriteButton nft={nft} variant="round" />
    </div>
  )
}

/**
 * Barra de compra do mobile (Figma): "Qtd. − 1 +" com o preço grande em laranja à direita e,
 * embaixo, "Comprar NFT" (gradiente laranja, leva ao carrinho) com o botão redondo do carrinho
 * ("Adicionar ao carrinho", fica na página com o toast). É `sticky` no rodapé da tela: gruda
 * enquanto o Detalhe rola e, no fim da rota, volta ao fluxo, então nunca cobre o fim do conteúdo
 * nem o footer. Não há tab bar nesta tela.
 */
export function MobilePurchaseBar({
  nft,
  selection,
  className,
}: {
  nft: Pick<Nft, 'id' | 'price'>
  /** A mesma seleção do `PurchasePanel`: a edição escolhida no painel é a que a barra compra. */
  selection: PurchaseSelection
  className?: string
}) {
  const { edition, quantity, setQuantity, soldOut } = selection
  return (
    <div
      data-slot="mobile-purchase-bar"
      className={cn(
        'bg-card border-border-soft sticky bottom-0 z-20 flex flex-col gap-4 rounded-t-[2rem] border-t px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.35)] md:hidden',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          min={1}
          max={edition?.available ?? 1}
          disabled={soldOut || !edition}
          appearance="accent"
          showLabel
        />
        <PriceTag price={nft.price} size="lg" tone="accent" live className="mt-2 min-w-0 justify-end text-right" />
      </div>
      <div className="flex items-center gap-4">
        {soldOut ? (
          <Button type="button" disabled className="text-body-lg h-14 flex-1 rounded-full font-bold">
            <Ban aria-hidden />
            Esgotado
          </Button>
        ) : (
          edition && (
            <>
              <AddToCartButton
                intent="buy"
                label="Comprar NFT"
                item={{ nftId: nft.id, edition: edition.kind, quantity }}
                available={edition.available}
                className="from-text-accent to-primary text-body-lg h-14 flex-1 rounded-full bg-linear-to-r font-bold hover:opacity-90"
              />
              <AddToCartButton
                iconOnly
                item={{ nftId: nft.id, edition: edition.kind, quantity }}
                available={edition.available}
                className={cn(ROUND_CLASS, 'size-14')}
              />
            </>
          )
        )}
      </div>
    </div>
  )
}
