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
  nft: Pick<Nft, 'id' | 'name' | 'imageUrl' | 'price' | 'editions' | 'collection'>
  /** Preço anterior riscado (Figma `70342:2681`) ou o preço de antes de um `nft.updated`. */
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
  /** `grid` = Início (258×356 no desktop), `carousel` = "Mais desta coleção" (219×303). A largura vem do container. */
  size?: NftCardSize
  /** Arte acima da dobra (primeira linha / destaque): carrega `eager` com `fetchpriority="high"` (LCP). */
  priority?: boolean
  className?: string
}

/**
 * Card do catálogo. O card inteiro é um link para `/nfts/$nftId`; "esgotado" (todas as edições
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
          'bg-card ring-border flex h-full flex-col gap-3 rounded-xl p-3 ring-1 outline-none transition-[box-shadow,background-color]',
          'hover:ring-border-soft hover:bg-muted focus-visible:ring-ring focus-visible:ring-3',
          size === 'carousel' && 'gap-2 p-2.5',
        )}
      >
        <div className="bg-muted relative aspect-square overflow-hidden rounded-lg">
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
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-muted-foreground truncate text-tiny uppercase">{nft.collection}</span>
          <h3 className={cn('truncate font-medium', size === 'carousel' ? 'text-caption' : 'text-body')}>
            {nft.name}
          </h3>
          <PriceTag
            price={nft.price}
            previousPrice={previousPrice}
            changed={priceChanged}
            size={size === 'carousel' ? 'sm' : 'md'}
          />
        </div>
      </Link>
      {onFavoriteToggle && (
        <FavoriteButton
          favorited={favorited}
          onToggle={onFavoriteToggle}
          nftName={nft.name}
          disabled={favoriteDisabled}
          className={cn('absolute z-10', size === 'carousel' ? 'top-4 right-4' : 'top-5 right-5', favoriteClassName)}
        />
      )}
    </article>
  )
}

export interface NftCardSkeletonProps {
  size?: NftCardSize
  className?: string
}

/** Placeholder do card enquanto a lista carrega (mesma caixa do card, sem pulsar com reduced motion). */
export function NftCardSkeleton({ size = 'grid', className }: NftCardSkeletonProps) {
  return (
    <div
      data-slot="nft-card-skeleton"
      aria-hidden
      className={cn(
        'bg-card ring-border flex flex-col gap-3 rounded-xl p-3 ring-1',
        size === 'carousel' && 'gap-2 p-2.5',
        className,
      )}
    >
      <Skeleton className="aspect-square w-full rounded-lg motion-reduce:animate-none" />
      {/* Mesmas caixas de linha do card (coleção text-tiny, nome e preço text-body/caption, gap-1),
          para a troca skeleton → card não deslocar o layout (CLS) */}
      <div className="flex flex-col gap-1">
        <SkeletonLine className="h-3.5" bar="h-2.5 w-1/3" />
        <SkeletonLine className={size === 'carousel' ? 'h-4.5' : 'h-5.25'} bar="h-3.5 w-2/3" />
        <SkeletonLine className={size === 'carousel' ? 'h-4.5' : 'h-5.25'} bar="h-3.5 w-1/2" />
      </div>
    </div>
  )
}

function SkeletonLine({ className, bar }: { className: string; bar: string }) {
  return (
    <div className={cn('flex items-center', className)}>
      <Skeleton className={cn(bar, 'motion-reduce:animate-none')} />
    </div>
  )
}
