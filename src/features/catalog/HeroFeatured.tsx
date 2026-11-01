import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useId, useState, type KeyboardEvent } from 'react'
import { featuredNftsQuery } from '@/api/nfts'
import type { Nft } from '@/contracts'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Caixa fixa da arte do hero (candidata a LCP): mesmas medidas na arte, no skeleton e no fallback. */
const ART_SIZE = 480
const artBox = 'aspect-square w-full max-w-[min(100%,30rem)] rounded-2xl'

/** Id fixo: o hero aparece uma vez por página, e os dots apontam para ele com `aria-controls`. */
const SLIDES_ID = 'hero-destaques'

/** Linha dos dots (botões `size-6`): reservada também no skeleton e no fallback, sem deslocar o layout. */
const dotsRow = 'flex h-6 items-center justify-center gap-2 md:justify-end'

/**
 * Hero do Início (Figma `2:2`): texto de boas-vindas fixo + carrossel dos destaques
 * (`GET /nfts/featured`). No desktop os dots ficam abaixo do texto, à esquerda da arte; no
 * celular, abaixo da arte. Sem auto-play; dots são botões e ←/→ trocam o slide quando o foco está
 * na arte ou nos dots. EXPLORAR leva ao catálogo mantendo os filtros da URL.
 */
export function HeroFeatured() {
  const featured = useQuery(featuredNftsQuery())
  const titleId = useId()
  const [index, setIndex] = useState(0)
  const items = featured.data ?? []
  const ready = !featured.isPending && !featured.isError && items.length > 0

  return (
    <section aria-labelledby={titleId} className="mx-auto w-full max-w-7xl px-4 pt-8 pb-10 md:px-6 md:pt-14">
      <div className="grid gap-6 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)_auto] md:gap-x-12 md:gap-y-4">
        <div className="flex flex-col items-start gap-4 md:col-start-1 md:row-start-1 md:self-center">
          <p className="text-foreground text-caption font-medium tracking-widest">Bem-vindo à Kurio</p>
          <h1 id={titleId} className="text-heading lg:text-display uppercase">
            Seja dono do futuro
            <br />
            da arte digital
          </h1>
          <p className="text-muted-foreground text-body max-w-prose leading-relaxed tracking-wide">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie
            artistas e tenha uma parte da cultura da internet.
          </p>
          <Link
            to="/"
            search={(prev) => prev}
            hash="catalogo"
            className={cn(buttonVariants({ size: 'lg' }), 'mt-2 px-6 font-bold tracking-wider uppercase')}
          >
            Explorar
          </Link>
        </div>
        <div className="flex justify-center md:col-start-2 md:row-span-2 md:row-start-1 md:justify-end">
          {featured.isPending ? (
            <Skeleton aria-hidden className={artBox} />
          ) : !ready ? (
            // Sem destaques: mantém a caixa (sem deslocar o layout) e não compete com o erro do grid
            <div
              className={cn(artBox, 'bg-muted border-border-soft flex items-center justify-center border border-dashed')}
            >
              <p className="text-muted-foreground text-caption px-6 text-center">Destaques indisponíveis no momento.</p>
            </div>
          ) : (
            <FeaturedSlide items={items} index={index} onIndexChange={setIndex} />
          )}
        </div>
        <div className="md:col-start-1 md:row-start-2">
          {ready ? (
            <FeaturedDots items={items} index={index} onIndexChange={setIndex} />
          ) : (
            <div aria-hidden className={dotsRow} />
          )}
        </div>
      </div>
    </section>
  )
}

interface CarouselProps {
  items: Nft[]
  index: number
  onIndexChange: (index: number) => void
}

/** ←/→ trocam o slide (com volta) quando o foco está na arte ou nos dots. */
function useArrowKeys({ items, index, onIndexChange }: CarouselProps) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    onIndexChange((index + step + items.length) % items.length)
  }
}

function FeaturedSlide(props: CarouselProps) {
  const { items, index } = props
  const current = items[Math.min(index, items.length - 1)]
  const onKeyDown = useArrowKeys(props)
  if (!current) return null

  return (
    <div
      id={SLIDES_ID}
      role="region"
      aria-roledescription="carrossel"
      aria-label="Destaques"
      onKeyDown={onKeyDown}
      className={artBox}
    >
      <Link
        to="/nfts/$nftId"
        params={{ nftId: current.id }}
        aria-roledescription="slide"
        className="focus-visible:ring-ring block size-full overflow-hidden rounded-2xl outline-none focus-visible:ring-3"
      >
        <img
          // Mesma caixa para todas as artes; a primeira carrega com prioridade (LCP)
          src={current.imageUrl}
          alt=""
          width={ART_SIZE}
          height={ART_SIZE}
          fetchPriority={index === 0 ? 'high' : undefined}
          loading="eager"
          decoding="async"
          className="bg-muted size-full object-cover"
        />
        {/* A arte não tem sobreposição (Figma); o nome do slide fica só para o leitor de tela */}
        <span className="sr-only">{`${current.name}, ${current.collection}`}</span>
      </Link>
      <p aria-live="polite" className="sr-only">
        {`Destaque ${index + 1} de ${items.length}: ${current.name}`}
      </p>
    </div>
  )
}

function FeaturedDots(props: CarouselProps) {
  const { items, index, onIndexChange } = props
  const onKeyDown = useArrowKeys(props)

  return (
    <div role="group" aria-label="Escolher destaque" onKeyDown={onKeyDown} className={dotsRow}>
      {items.map((nft, i) => (
        <button
          key={nft.id}
          type="button"
          aria-label={`Destaque ${i + 1} de ${items.length}`}
          aria-current={i === index ? 'true' : undefined}
          aria-controls={SLIDES_ID}
          onClick={() => onIndexChange(i)}
          className="focus-visible:ring-ring flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-3"
        >
          <span
            aria-hidden
            className={cn(
              'bg-primary block h-2 rounded-full transition-[width,opacity] motion-reduce:transition-none',
              i === index ? 'w-5' : 'w-2 opacity-50',
            )}
          />
        </button>
      ))}
    </div>
  )
}
