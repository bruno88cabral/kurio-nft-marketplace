import { Link } from '@tanstack/react-router'
import { Ban } from 'lucide-react'
import type { EthAmount, Nft } from '@/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { isSoldOut } from '@/lib/editions'
import { nftArtSize } from '@/lib/nftArt'
import { cn } from '@/lib/utils'
import { FavoriteButton } from './FavoriteButton'
import { PriceTag } from './PriceTag'

export type NftCardSize = 'grid' | 'carousel'

export interface NftCardProps {
  nft: Pick<Nft, 'id' | 'name' | 'imageUrl' | 'price' | 'editions'>
  /** Preço anterior em cinza ao lado (Figma `70342:2681`) ou o preço de antes de um `nft.updated`. */
  previousPrice?: EthAmount
  /** Destaca o preço como "alterado (tempo real)" (ver `PriceTag`). */
  priceChanged?: boolean
  /** Selo sobre a arte, ex.: "RARO" (Figma mobile `15:5496`). */
  badge?: string
  /**
   * Favorito funcional (R-1). Sem `onFavoriteToggle` o botão não aparece. O botão fica FORA do
   * link do card (irmão posicionado sobre a arte), para não aninhar elementos interativos.
   */
  favorited?: boolean
  onFavoriteToggle?: () => void
  /** Desabilita o favorito (ex.: sessão ainda sendo confirmada). */
  favoriteDisabled?: boolean
  /** Classes extras do botão de favorito (ex.: `md:hidden` para mostrá-lo só no mobile). */
  favoriteClassName?: string
  /** `grid` = Início (bloco 258×300 no desktop), `carousel` = "Mais desta coleção". A largura vem do container. */
  size?: NftCardSize
  /** Arte acima da dobra (primeira linha / destaque): carrega `eager` com `fetchpriority="high"` (LCP). */
  priority?: boolean
  className?: string
}

/**
 * Card do catálogo (Figma: sem borda, sem eyebrow da coleção, nome em peso regular e preço em
 * laranja e negrito). O card inteiro é um link para `/nfts/$nftId`; "esgotado" (todas as edições
 * com `available` 0) aparece como selo com ícone e texto, não só pela cor.
 */
export function NftCard({
  nft,
  previousPrice,
  priceChanged,
  badge,
  favorited = false,
  onFavoriteToggle,
  favoriteDisabled,
  favoriteClassName,
  size = 'grid',
  priority = false,
  className,
}: NftCardProps) {
  const soldOut = isSoldOut(nft.editions)
  const art = nftArtSize(nft.imageUrl)

  return (
    <article
      data-slot="nft-card"
      data-sold-out={soldOut || undefined}
      className={cn('group/nft-card relative', className)}
    >
      <Link
        to="/nfts/$nftId"
        params={{ nftId: nft.id }}
        className={cn(
          'flex h-full flex-col gap-3 rounded-sm outline-none',
          'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-3 focus-visible:ring-offset-2',
          size === 'carousel' && 'gap-2',
        )}
      >
        {/* Figma: a arte fica num bloco #241612 sem borda (arredondado só no mobile), com a imagem
            arredondada dentro; nome e preço ficam fora do bloco, sobre o fundo da página */}
        <div className={cn('bg-card group-hover/nft-card:bg-muted transition-colors', BLOCK[size])}>
          <div className="bg-muted relative aspect-square overflow-hidden rounded-xl">
            <img
              src={nft.imageUrl}
              alt=""
              width={art.width}
              height={art.height}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : undefined}
              decoding="async"
              className={cn(
                'size-full object-cover transition-transform duration-300 group-hover/nft-card:scale-105 motion-reduce:transition-none motion-reduce:group-hover/nft-card:scale-100',
                soldOut && 'opacity-60 grayscale',
              )}
            />
            {badge && (
              <span className="bg-primary text-primary-foreground absolute top-2 left-2 rounded-sm px-1.5 py-0.5 text-tiny font-bold uppercase">
                {badge}
              </span>
            )}
            {soldOut && (
              <span className="bg-background/85 text-foreground border-border-soft absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-tiny font-bold uppercase">
                <Ban aria-hidden className="size-3" />
                Esgotado
              </span>
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className={cn('truncate font-normal', TEXT[size])}>{nft.name}</h3>
          <PriceTag
            price={nft.price}
            previousPrice={previousPrice}
            changed={priceChanged}
            tone="accent"
            size={size === 'carousel' ? 'sm' : 'md'}
            className={TEXT[size]}
          />
        </div>
      </Link>
      {onFavoriteToggle && (
        <FavoriteButton
          favorited={favorited}
          onToggle={onFavoriteToggle}
          nftName={nft.name}
          disabled={favoriteDisabled}
          className={cn('absolute z-10', FAVORITE[size], favoriteClassName)}
        />
      )}
    </article>
  )
}

/** Bloco da arte (o skeleton usa o mesmo, para a troca não deslocar o layout). */
const BLOCK: Record<NftCardSize, string> = {
  grid: 'rounded-2xl px-1 py-4 md:rounded-none md:py-6',
  carousel: 'rounded-2xl px-1 py-3 md:rounded-none',
}

/** Nome e preço: 16 px no grid (Figma), 12 px no carrossel. */
const TEXT: Record<NftCardSize, string> = {
  grid: 'text-body-lg',
  carousel: 'text-caption',
}

/** Favorito 8 px para dentro da imagem, que começa depois do padding do bloco. */
const FAVORITE: Record<NftCardSize, string> = {
  grid: 'top-6 right-3 md:top-8',
  carousel: 'top-5 right-3',
}

export interface NftCardSkeletonProps {
  size?: NftCardSize
  className?: string
}

/** Placeholder do card enquanto a lista carrega: mesmo bloco da arte e mesmas linhas de nome e preço (sem CLS). */
export function NftCardSkeleton({ size = 'grid', className }: NftCardSkeletonProps) {
  // Linha do texto: text-body-lg = 24 px, text-caption = 18 px
  const line = size === 'carousel' ? 'h-4.5' : 'h-6'
  return (
    <div
      data-slot="nft-card-skeleton"
      aria-hidden
      className={cn('flex flex-col gap-3', size === 'carousel' && 'gap-2', className)}
    >
      <div className={cn('bg-card', BLOCK[size])}>
        <Skeleton className="aspect-square w-full rounded-xl" />
      </div>
      <div className="flex flex-col gap-1">
        <SkeletonLine className={line} bar="h-3.5 w-2/3" />
        <SkeletonLine className={line} bar="h-3.5 w-1/3" />
      </div>
    </div>
  )
}

function SkeletonLine({ className, bar }: { className: string; bar: string }) {
  return (
    <div className={cn('flex items-center', className)}>
      <Skeleton className={bar} />
    </div>
  )
}
