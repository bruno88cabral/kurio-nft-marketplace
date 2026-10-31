import type { ComponentProps } from 'react'
import type { Nft } from '@/contracts'
import { FavoriteButton, NftCard } from '@/components/kurio'
import { useToggleFavorite } from './useToggleFavorite'

/** Região `aria-live` com o resultado do último clique (o erro sai pelo toast, que já é anunciado). */
function FavoriteAnnouncement({ message }: { message: string }) {
  return (
    <span aria-live="polite" className="sr-only">
      {message}
    </span>
  )
}

export interface NftFavoriteButtonProps {
  nft: Pick<Nft, 'id' | 'name'>
  variant?: ComponentProps<typeof FavoriteButton>['variant']
  className?: string
}

/**
 * Favoritar ligado ao cache (Detalhe, Figma `70342:2757`). O `FavoriteButton` do kit dá o toggle
 * (`aria-pressed`, nome fixo "Favoritar <nome>"); aqui entram o hook otimista e o `aria-live`.
 */
export function NftFavoriteButton({ nft, variant = 'default', className }: NftFavoriteButtonProps) {
  const { favorited, toggle, pending, announcement } = useToggleFavorite(nft.id)
  return (
    <>
      <FavoriteButton
        favorited={favorited}
        onToggle={toggle}
        nftName={nft.name}
        variant={variant}
        disabled={pending}
        className={className}
      />
      <FavoriteAnnouncement message={announcement} />
    </>
  )
}

/**
 * `NftCard` com o favorito funcional só no mobile (Figma `15:5465`); no desktop o card do
 * catálogo não tem coração. O botão continua fora do link do card (o kit garante).
 */
export function FavoritableNftCard(props: Omit<ComponentProps<typeof NftCard>, 'favorited' | 'onFavoriteToggle'>) {
  const { favorited, toggle, pending, announcement } = useToggleFavorite(props.nft.id)
  return (
    <>
      <NftCard
        {...props}
        favorited={favorited}
        onFavoriteToggle={toggle}
        favoriteDisabled={pending}
        favoriteClassName="md:hidden"
      />
      <FavoriteAnnouncement message={announcement} />
    </>
  )
}
