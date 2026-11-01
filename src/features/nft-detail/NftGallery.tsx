import { Search } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import type { Nft } from '@/contracts'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { nftArtSize } from '@/lib/nftArt'
import { cn } from '@/lib/utils'
import { GALLERY_ART_CLASS, GALLERY_CLASS, GALLERY_MAIN_CLASS } from './layout'

function imageAlt(name: string, index: number, total: number): string {
  return `${name}, imagem ${index + 1} de ${total}`
}

const NEXT_KEYS: Record<string, 1 | -1> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

/**
 * Arte principal + miniaturas (Figma desktop: coluna de miniaturas à esquerda e a arte num painel
 * `#241612` com lupa no canto). Funciona com N imagens (`nft.images`).
 *
 * - A partir de `md` a coluna aparece sempre, mesmo com 1 imagem: a largura da arte (e a altura da
 *   página) não muda com a quantidade de imagens, e o skeleton tem a mesma caixa.
 * - No mobile (Figma: só a arte) as miniaturas flutuam sobre a base da arte e só aparecem com mais
 *   de 1 imagem; por serem sobrepostas, não mudam a altura.
 * - Miniaturas são botões "Imagem i de N" (a arte delas é decorativa) com `aria-pressed`; ←/→ (e ↑/↓ na coluna) trocam a imagem, com volta
 *   circular, e levam o foco junto.
 * - A lupa abre a arte maior num diálogo (a partir de `md`).
 *
 * `width`/`height` vêm do manifest das artes (sem CLS). Remonte com `key={nft.id}` ao trocar de NFT.
 */
export function NftGallery({ nft, className }: { nft: Pick<Nft, 'name' | 'images' | 'imageUrl'>; className?: string }) {
  const images = nft.images.length > 0 ? nft.images : [nft.imageUrl]
  const total = images.length
  const [selected, setSelected] = useState(0)
  const index = Math.min(selected, total - 1)
  const thumbs = useRef<(HTMLButtonElement | null)[]>([])
  const main = images[index]
  const mainSize = nftArtSize(main)
  const mainAlt = imageAlt(nft.name, index, total)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = NEXT_KEYS[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = (index + step + total) % total
    setSelected(next)
    thumbs.current[next]?.focus()
  }

  return (
    <div data-slot="nft-gallery" className={cn(GALLERY_CLASS, className)}>
      <div className={GALLERY_MAIN_CLASS}>
        <div className={GALLERY_ART_CLASS}>
          <img
            src={main}
            alt={mainAlt}
            width={mainSize.width}
            height={mainSize.height}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="size-full object-cover"
          />
        </div>
        <Dialog>
          <DialogTrigger
            aria-label={`Ampliar ${mainAlt}`}
            className="bg-background/80 text-foreground hover:bg-background focus-visible:ring-ring absolute top-1 right-1 hidden size-11 items-center justify-center rounded-full outline-none focus-visible:ring-3 md:inline-flex lg:top-2 lg:right-2"
          >
            <Search aria-hidden className="size-5" />
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 p-4 sm:max-w-3xl">
            <DialogTitle className="pr-10">{nft.name}</DialogTitle>
            <img
              src={main}
              alt={mainAlt}
              width={mainSize.width}
              height={mainSize.height}
              decoding="async"
              className="bg-muted mx-auto aspect-square max-h-[calc(100dvh-8rem)] w-full rounded-xl object-contain"
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className={cn('md:relative md:col-start-1 md:row-start-1', total === 1 && 'max-md:hidden')}>
        <div
          role="group"
          aria-label="Imagens do NFT"
          onKeyDown={onKeyDown}
          className="absolute bottom-11 left-3 flex gap-2 md:inset-0 md:flex-col md:gap-2 lg:gap-3 md:overflow-y-auto md:p-0.5"
        >
          {images.map((src, i) => {
            const size = nftArtSize(src)
            return (
              <button
                key={`${i}:${src}`}
                ref={(el) => {
                  thumbs.current[i] = el
                }}
                type="button"
                aria-label={`Imagem ${i + 1} de ${total}`}
                aria-pressed={i === index}
                onClick={() => setSelected(i)}
                className={cn(
                  'bg-muted ring-background/70 focus-visible:ring-ring size-11 shrink-0 overflow-hidden rounded-lg ring-2 outline-none focus-visible:ring-3 md:aspect-square md:size-auto md:w-full md:ring-1 md:ring-transparent',
                  i === index && 'ring-text-accent md:ring-text-accent ring-2 md:ring-2',
                )}
              >
                <img
                  src={src}
                  alt=""
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
      </div>
    </div>
  )
}
