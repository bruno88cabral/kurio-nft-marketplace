import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { featuredNftsQuery } from '@/api/nfts'
import type { Nft } from '@/contracts'
import { PriceTag } from '@/components/kurio'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/** Caixa fixa da arte do hero (candidata a LCP): mesmas medidas na arte, no skeleton e no fallback. */
const ART_SIZE = 480
const artBox = 'aspect-square w-full max-w-[min(100%,30rem)] rounded-2xl'

/**
 * Hero do Início (Figma `2:2`): texto de boas-vindas fixo + carrossel dos destaques
 * (`GET /nfts/featured`). Sem auto-play; dots são botões e ←/→ trocam o slide quando o foco
 * está dentro do carrossel. EXPLORAR leva ao catálogo mantendo os filtros da URL.
 */
export function HeroFeatured() {
  const featured = useQuery(featuredNftsQuery())
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="mx-auto w-full max-w-7xl px-4 pt-8 pb-10 md:px-6 md:pt-14">
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
        <div className="flex flex-col items-start gap-4">
          <p className="text-text-accent text-caption font-bold tracking-widest uppercase">Bem-vindo à Kurio</p>
          <h1 id={titleId} className="text-heading lg:text-display uppercase">
            Seja dono do futuro
            <br />
            da arte digital
          </h1>
          <p className="text-muted-foreground text-body md:text-body-lg max-w-prose">
            Descubra coleções de artistas independentes, escolha a edição que combina com você e
            acompanhe preço e estoque em tempo real.
          </p>
          <Link
            to="/"
            search={(prev) => prev}
            hash="catalogo"
            className={cn(buttonVariants({ size: 'lg' }), 'mt-2 font-bold tracking-wider uppercase')}
          >
            Explorar
            <ArrowRight aria-hidden />
          </Link>
        </div>
        <div className="flex justify-center md:justify-end">
          {featured.isPending ? (
            <div className={cn(artBox, 'flex flex-col gap-4')} aria-hidden>
              <Skeleton className="aspect-square w-full rounded-2xl motion-reduce:animate-none" />
            </div>
          ) : featured.isError || featured.data.length === 0 ? (
            // Sem destaques: mantém a caixa (sem deslocar o layout) e não compete com o erro do grid
            <div
              className={cn(artBox, 'bg-muted border-border-soft flex items-center justify-center border border-dashed')}
            >
              <p className="text-muted-foreground text-caption px-6 text-center">Destaques indisponíveis no momento.</p>
            </div>
          ) : (
            <FeaturedCarousel items={featured.data} />
          )}
        </div>
      </div>
    </section>
  )
}

function FeaturedCarousel({ items }: { items: Nft[] }) {
  const [index, setIndex] = useState(0)
  const current = items[Math.min(index, items.length - 1)]
  if (!current) return null
  const go = (next: number) => setIndex((next + items.length) % items.length)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') go(index + 1)
    else if (e.key === 'ArrowLeft') go(index - 1)
    else return
    e.preventDefault()
  }

  return (
    <div
      role="region"
      aria-roledescription="carrossel"
      aria-label="Destaques"
      onKeyDown={onKeyDown}
      className={cn(artBox, 'relative')}
    >
      <Link
        to="/nfts/$nftId"
        params={{ nftId: current.id }}
        aria-roledescription="slide"
        className="group/hero focus-visible:ring-ring block size-full overflow-hidden rounded-2xl outline-none focus-visible:ring-3"
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
        <span className="from-background/95 absolute inset-x-0 bottom-0 flex flex-col gap-1 rounded-b-2xl bg-gradient-to-t to-transparent px-5 pt-16 pb-12">
          <span className="text-muted-foreground text-tiny uppercase">{current.collection}</span>
          <span className="text-body-lg font-medium group-hover/hero:underline">{current.name}</span>
          <PriceTag price={current.price} previousPrice={current.previousPrice} />
        </span>
      </Link>
      <p aria-live="polite" className="sr-only">
        {`Destaque ${index + 1} de ${items.length}: ${current.name}`}
      </p>
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
        {items.map((nft, i) => (
          <button
            key={nft.id}
            type="button"
            aria-label={`Destaque ${i + 1} de ${items.length}`}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => setIndex(i)}
            className="focus-visible:ring-ring flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-3"
          >
            <span
              aria-hidden
              className={cn(
                'block h-2 rounded-full transition-[width,background-color] motion-reduce:transition-none',
                i === index ? 'bg-primary w-6' : 'bg-foreground/40 w-2',
              )}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
