import { useRef, useState, type KeyboardEvent } from 'react'
import type { Nft } from '@/contracts'
import { nftArtSize } from '@/lib/nftArt'
import { cn } from '@/lib/utils'

function imageAlt(name: string, index: number, total: number): string {
  return `${name}, imagem ${index + 1} de ${total}`
}

/**
 * Arte principal + miniaturas (Figma `11:1161`, `11:1181`–`11:1190`). As miniaturas são botões
 * com `aria-pressed`; ←/→ no grupo trocam a imagem e levam o foco junto. Com uma imagem só
 * (o caso de todas as fixtures hoje) as miniaturas não aparecem. `width`/`height` vêm do
 * manifest das artes (sem CLS). Remonte com `key={nft.id}` ao trocar de NFT.
 */
export function NftGallery({ nft }: { nft: Pick<Nft, 'name' | 'images' | 'imageUrl'> }) {
  const images = nft.images.length > 0 ? nft.images : [nft.imageUrl]
  const total = images.length
  const [selected, setSelected] = useState(0)
  const index = Math.min(selected, total - 1)
  const thumbs = useRef<(HTMLButtonElement | null)[]>([])
  const main = images[index]
  const mainSize = nftArtSize(main)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + total) % total
    setSelected(next)
    thumbs.current[next]?.focus()
  }

  return (
    <div data-slot="nft-gallery" className="flex min-w-0 flex-col gap-3">
      <div className="bg-muted ring-border aspect-square overflow-hidden rounded-xl ring-1">
        <img
          src={main}
          alt={imageAlt(nft.name, index, total)}
          width={mainSize.width}
          height={mainSize.height}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="size-full object-cover"
        />
      </div>
      {total > 1 && (
        <div role="group" aria-label="Imagens do NFT" onKeyDown={onKeyDown} className="grid grid-cols-4 gap-2 sm:gap-3">
          {images.map((src, i) => {
            const size = nftArtSize(src)
            return (
              <button
                key={src}
                ref={(el) => {
                  thumbs.current[i] = el
                }}
                type="button"
                aria-pressed={i === index}
                onClick={() => setSelected(i)}
                className={cn(
                  'bg-muted ring-border focus-visible:ring-ring aspect-square overflow-hidden rounded-lg ring-1 outline-none focus-visible:ring-3',
                  i === index && 'ring-primary ring-2',
                )}
              >
                <img
                  src={src}
                  alt={imageAlt(nft.name, i, total)}
                  width={size.width}
                  height={size.height}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
