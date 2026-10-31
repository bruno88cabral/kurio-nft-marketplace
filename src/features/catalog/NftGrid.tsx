import type { Nft } from '@/contracts'
import { NftCard, NftCardSkeleton, type NftCardSize } from '@/components/kurio'
import { FavoritableNftCard } from '@/features/favorites/FavoriteButton'
import { cn } from '@/lib/utils'

/** Colunas do catálogo: 2 no mobile, 3 a partir de `md` (Figma `2:2`: 3×3). */
const NFT_GRID_CLASS = 'grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-6'

export interface NftGridProps {
  items: Nft[]
  /** Refetch com o dado anterior na tela (`isPlaceholderData`): opacidade reduzida + `aria-busy`. */
  stale?: boolean
  size?: NftCardSize
  /** Rótulo da lista para leitores de tela. */
  label?: string
  /** Liga o favorito funcional no card, só no mobile (catálogo do Início, MYK-1076). */
  favoritable?: boolean
  className?: string
}

/** Grade de `NftCard` (presentacional; reaproveitável fora do Início, ex.: "Mais desta coleção"). */
export function NftGrid({
  items,
  stale = false,
  size = 'grid',
  label = 'NFTs',
  favoritable = false,
  className,
}: NftGridProps) {
  return (
    <ul
      aria-label={label}
      aria-busy={stale || undefined}
      className={cn(NFT_GRID_CLASS, 'transition-opacity motion-reduce:transition-none', stale && 'opacity-60', className)}
    >
      {items.map((nft) => (
        <li key={nft.id} className="min-w-0">
          {favoritable ? (
            <FavoritableNftCard nft={nft} previousPrice={nft.previousPrice} size={size} className="h-full" />
          ) : (
            <NftCard nft={nft} previousPrice={nft.previousPrice} size={size} className="h-full" />
          )}
        </li>
      ))}
    </ul>
  )
}

export interface NftGridSkeletonProps {
  count: number
  size?: NftCardSize
  className?: string
}

/** Mesma grade com `NftCardSkeleton` (mesma caixa do card, para não deslocar o layout). */
export function NftGridSkeleton({ count, size = 'grid', className }: NftGridSkeletonProps) {
  return (
    <div aria-hidden className={cn(NFT_GRID_CLASS, className)}>
      {Array.from({ length: count }, (_, i) => (
        <NftCardSkeleton key={i} size={size} />
      ))}
    </div>
  )
}
