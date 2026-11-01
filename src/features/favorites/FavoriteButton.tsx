import type { ComponentProps } from 'react'
import type { Nft } from '@/contracts'
import { FavoriteButton, NftCard } from '@/components/kurio'
import { useToggleFavorite } from './useToggleFavorite'

export interface NftFavoriteButtonProps {
  nft: Pick<Nft, 'id' | 'name'>
  variant?: ComponentProps<typeof FavoriteButton>['variant']
  className?: string
}

/**
 * Favoritar ligado ao cache (Detalhe, Figma `70342:2757`). O `FavoriteButton` do kit dá o toggle
 * (`aria-pressed`, nome fixo "Favoritar <nome>"); aqui entra o hook otimista, que anuncia o resultado na região
 * `aria-live` única do app.
 */
export function NftFavoriteButton({ nft, variant = 'default', className }: NftFavoriteButtonProps) {
  const { favorited, toggle, pending } = useToggleFavorite(nft.id)
  return (
    <FavoriteButton
      favorited={favorited}
      onToggle={toggle}
      nftName={nft.name}
      variant={variant}
      disabled={pending}
      className={className}
    />
  )
}

/**
 * `NftCard` com o favorito funcional só no mobile (Figma `15:5465`); no desktop o card do
 * catálogo não tem coração. O botão continua fora do link do card (o kit garante).
 */
export function FavoritableNftCard(props: Omit<ComponentProps<typeof NftCard>, 'favorited' | 'onFavoriteToggle'>) {
  const { favorited, toggle, pending } = useToggleFavorite(props.nft.id)
  return (
    <NftCard
      {...props}
      favorited={favorited}
      onFavoriteToggle={toggle}
      favoriteDisabled={pending}
      // Alvo de 44 px (§8) sem mudar o círculo de 28 px do Figma: o ::after estende a área de toque
      favoriteClassName="md:hidden after:absolute after:-inset-2"
    />
  )
}
