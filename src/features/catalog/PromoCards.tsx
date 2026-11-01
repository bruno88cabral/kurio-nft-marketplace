import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { withFilter } from '@/lib/catalogSearch'
import { nftArtSize } from '@/lib/nftArt'
import { cn } from '@/lib/utils'

/** Textos do Figma `2:2`; o do segundo card é cortado no desenho e foi completado aqui. */
const PROMOS = [
  {
    tab: 'new',
    title: 'Lançamentos gênesis de edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    art: '/nfts/coral-byte.svg',
  },
  {
    tab: 'trending',
    title: 'Arte digital selecionada e muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura da internet.',
    art: '/nfts/tide-glitch.svg',
  },
] as const

/**
 * Os dois cards promocionais do Figma `2:2`: arte grande à esquerda, na altura do card, e texto
 * alinhado à direita com o botão "Explorar →", que abre a aba correspondente do catálogo.
 */
export function PromoCards() {
  return (
    <section aria-label="Coleções em destaque" className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">
      <ul className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        {PROMOS.map((p) => {
          const size = nftArtSize(p.art)
          return (
            <li
              key={p.tab}
              className="bg-card grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-center gap-4 overflow-hidden rounded-2xl"
            >
              {/* A arte ocupa a altura do card: altura mínima fixa, esticada se o texto for mais alto */}
              <div className="relative min-h-40 w-full self-stretch sm:min-h-56">
                <img
                  src={p.art}
                  alt=""
                  width={size.width}
                  height={size.height}
                  loading="lazy"
                  decoding="async"
                  className="bg-muted absolute inset-0 size-full rounded-2xl object-cover"
                />
              </div>
              <div className="flex min-w-0 flex-col items-end gap-3 py-5 pr-5 text-right sm:pr-6">
                <h2 className="text-body sm:text-body-lg font-bold tracking-wide">{p.title}</h2>
                <p className="text-muted-foreground text-caption sm:text-body tracking-wide">{p.text}</p>
                <Link
                  to="/"
                  search={withFilter({}, { tab: p.tab })}
                  hash="catalogo"
                  className={cn(buttonVariants(), 'px-5')}
                >
                  Explorar
                  <ArrowRight aria-hidden />
                  <span className="sr-only"> {p.title.toLowerCase()}</span>
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
