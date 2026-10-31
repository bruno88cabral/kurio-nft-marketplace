import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { withFilter } from '@/lib/catalogSearch'
import { nftArtSize } from '@/lib/nftArt'

const PROMOS = [
  {
    tab: 'new',
    eyebrow: 'Acabou de chegar',
    title: 'Novos lançamentos',
    text: 'As obras listadas nas últimas duas semanas, direto dos ateliês.',
    art: '/nfts/coral-byte.svg',
  },
  {
    tab: 'trending',
    eyebrow: 'Mais procurados',
    title: 'Em alta',
    text: 'Edições limitadas que estão perto de esgotar.',
    art: '/nfts/tide-glitch.svg',
  },
] as const

/** Os dois cards promocionais do Figma `2:2`; "Explorar →" abre a aba correspondente do catálogo. */
export function PromoCards() {
  return (
    <section aria-label="Coleções em destaque" className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">
      <ul className="grid gap-4 md:grid-cols-2 md:gap-6">
        {PROMOS.map((p) => {
          const size = nftArtSize(p.art)
          return (
            <li
              key={p.tab}
              className="bg-card ring-border flex items-center gap-4 overflow-hidden rounded-2xl p-5 ring-1 sm:gap-6 sm:p-6"
            >
              <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
                <p className="text-text-accent text-tiny font-bold tracking-widest uppercase">{p.eyebrow}</p>
                <h2 className="text-body-lg font-bold sm:text-heading">{p.title}</h2>
                <p className="text-muted-foreground text-caption sm:text-body">{p.text}</p>
                <Link
                  to="/"
                  search={withFilter({}, { tab: p.tab })}
                  hash="catalogo"
                  className="text-text-accent text-body focus-visible:ring-ring mt-1 inline-flex items-center gap-1 rounded-sm font-medium outline-none hover:underline focus-visible:ring-3"
                >
                  Explorar
                  <ArrowRight aria-hidden className="size-4" />
                  <span className="sr-only"> {p.title.toLowerCase()}</span>
                </Link>
              </div>
              <img
                src={p.art}
                alt=""
                width={size.width}
                height={size.height}
                loading="lazy"
                decoding="async"
                className="size-24 shrink-0 rounded-xl object-cover sm:size-32"
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
