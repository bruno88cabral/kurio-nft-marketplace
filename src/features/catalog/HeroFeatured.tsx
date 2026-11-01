import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { featuredNftsQuery } from '@/api/nfts'
import type { Nft } from '@/contracts'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Caixa fixa da arte do hero (candidata a LCP): mesmas medidas na arte, no skeleton e no fallback. */
const ART_SIZE = 480
/** No mobile a arte é uma coluna estreita dentro do card (Figma `Mobile/Início.png`); a partir de `md`, a coluna inteira. */
const artBox = 'relative aspect-square w-34 rounded-2xl sm:w-48 md:w-full md:max-w-[min(100%,30rem)]'

/** Id fixo: o hero aparece uma vez por página, e os dots apontam para ele com `aria-controls`. */
const SLIDES_ID = 'hero-destaques'

/** Linha dos dots (botões `size-6`): reservada também no skeleton e no fallback, sem deslocar o layout. */
const dotsRow = 'flex h-6 items-center justify-center gap-2 md:justify-end'

/**
 * Card do hero abaixo de `md` (Figma mobile): fundo marrom em gradiente, arredondado, com o texto à
 * esquerda, a arte à direita e os dots centralizados embaixo. A partir de `md` o card some (sem
 * fundo nem padding) e vale o layout do desktop (Figma `2:2`).
 */
const heroCard =
  'overflow-hidden rounded-[1.75rem] bg-[radial-gradient(circle_at_45%_55%,rgb(255_255_255/0.07)_0_38%,transparent_38.5%),linear-gradient(135deg,#7a5233,#4a2f1f_55%,#2f1e15)] p-4 pb-2 md:overflow-visible md:rounded-none md:bg-none md:p-0'

/**
 * Hero do Início (Figma `2:2` no desktop, `Mobile/Início.png` no celular): texto de boas-vindas
 * fixo + carrossel dos destaques (`GET /nfts/featured`). No desktop os dots ficam abaixo do texto,
 * à esquerda da arte; no celular, centralizados no fim do card, e a arte ganha a miniatura do
 * próximo destaque sobreposta. Sem auto-play; dots são botões e ←/→ trocam o slide quando o foco
 * está na arte ou nos dots. EXPLORAR leva ao catálogo mantendo os filtros da URL.
 */
export function HeroFeatured() {
  const featured = useQuery(featuredNftsQuery())
  const titleId = useId()
  const [index, setIndex] = useState(0)
  const items = featured.data ?? []
  const ready = !featured.isPending && !featured.isError && items.length > 0

  return (
    <section aria-labelledby={titleId} className="mx-auto w-full max-w-7xl px-4 pt-6 pb-6 md:px-6 md:pt-14 md:pb-10">
      <div
        className={cn(
          'grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 md:grid-cols-2 md:grid-rows-[minmax(0,1fr)_auto] md:gap-x-12 md:gap-y-4',
          heroCard,
        )}
      >
        <div className="col-start-1 row-start-1 flex flex-col items-start gap-2 self-center md:gap-4">
          <p className="text-foreground text-caption font-medium tracking-widest">Bem-vindo à Kurio</p>
          {/* O Figma mobile tem outro título e outro texto; o escondido por `display` some também
              para o leitor de tela */}
          <h1 id={titleId} className="text-lg/relaxed font-bold uppercase max-md:tracking-wide md:text-heading lg:text-display">
            <span className="md:hidden">Seja dono da cultura digital</span>
            <span className="max-md:hidden">
              Seja dono do futuro
              <br />
              da arte digital
            </span>
          </h1>
          <p className="text-muted-foreground text-caption md:text-body max-w-prose leading-relaxed tracking-wide">
            <span className="md:hidden">Descubra NFTs selecionados de criadores do mundo todo.</span>
            <span className="max-md:hidden">
              Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie
              artistas e tenha uma parte da cultura da internet.
            </span>
          </p>
          <Link
            to="/"
            search={(prev) => prev}
            hash="catalogo"
            className="text-text-accent text-body focus-visible:ring-ring -mx-1 inline-flex min-h-11 items-center gap-2 rounded-md px-1 font-bold tracking-wider uppercase outline-none focus-visible:ring-3 md:hidden"
          >
            Explorar
            <ArrowRight aria-hidden className="size-5" />
          </Link>
          <Link
            to="/"
            search={(prev) => prev}
            hash="catalogo"
            className={cn(buttonVariants({ size: 'lg' }), 'mt-2 px-6 font-bold tracking-wider uppercase max-md:hidden')}
          >
            Explorar
          </Link>
        </div>
        <div className="col-start-2 row-start-1 flex justify-center self-center md:row-span-2 md:justify-end md:self-auto">
          {featured.isPending ? (
            <Skeleton aria-hidden className={artBox} />
          ) : !ready ? (
            // Sem destaques: mantém a caixa (sem deslocar o layout) e não compete com o erro do grid
            <div
              className={cn(artBox, 'bg-muted border-border-soft flex items-center justify-center border border-dashed')}
            >
              <p className="text-muted-foreground text-tiny md:text-caption px-2 text-center md:px-6">
                Destaques indisponíveis no momento.
              </p>
            </div>
          ) : (
            <FeaturedSlide items={items} index={index} onIndexChange={setIndex} />
          )}
        </div>
        <div className="col-span-2 md:col-span-1 md:col-start-1 md:row-start-2">
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
  const next = items[(index + 1) % items.length]
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
      {/* Padrão APG de carrossel: o slide é um grupo ("slide n de N") e a arte dentro dele continua um link */}
      <div
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} de ${items.length}`}
        className="size-full"
      >
        <Link
          to="/nfts/$nftId"
          params={{ nftId: current.id }}
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
      </div>
      {/* Mobile (Figma): a miniatura do próximo destaque sobreposta ao canto da arte; decorativa */}
      {next && next !== current && (
        <img
          aria-hidden
          src={next.imageUrl}
          alt=""
          width={ART_SIZE}
          height={ART_SIZE}
          // Acima da dobra no mobile: sem `lazy` (Lighthouse "lazy-loaded LCP/above-the-fold")
          decoding="async"
          className="bg-muted border-card pointer-events-none absolute -bottom-3 left-3 size-16 rounded-xl border-2 object-cover md:hidden"
        />
      )}
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
          {/* O ativo é mais largo (não só cor); o inativo a 80% fica ≥ 3:1 nos fundos do hero (WCAG 1.4.11) */}
          <span
            aria-hidden
            className={cn(
              'bg-primary block h-2 rounded-full transition-[width,opacity] motion-reduce:transition-none',
              i === index ? 'w-5' : 'w-2 opacity-80',
            )}
          />
        </button>
      ))}
    </div>
  )
}
