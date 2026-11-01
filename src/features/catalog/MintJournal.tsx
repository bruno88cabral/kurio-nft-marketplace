import { useId } from 'react'
import { OutOfScopeAction } from '@/components/kurio'
import { nftArtSize } from '@/lib/nftArt'

/**
 * "Diário da Cunhagem" (blog do Figma `2:2`). A página editorial está fora do escopo (§3): o bloco
 * existe pela fidelidade visual, com os textos do Figma (não são dados de negócio) e "Ler mais" no
 * padrão `OutOfScopeAction`. As imagens são as artes do kit.
 */
const POSTS = [
  {
    date: '2026-09-12',
    dateLabel: '12 de setembro',
    readingTime: 'Leitura de 6 min',
    title: 'Como funciona a propriedade de NFTs',
    excerpt: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
    art: '/nfts/macaco-oculos-960.webp',
  },
  {
    date: '2026-09-13',
    dateLabel: '13 de setembro',
    readingTime: 'Leitura de 2 min',
    title: '10 artistas digitais para acompanhar',
    excerpt: 'Conheça criadores que moldam a cultura digital.',
    art: '/nfts/macaco-gola-alta-960.webp',
  },
  {
    date: '2026-09-15',
    dateLabel: '15 de setembro',
    readingTime: 'Leitura de 3 min',
    title: 'Raridade, atributos e procedência',
    excerpt: 'Entenda raridade, procedência, direitos autorais e utilidade.',
    art: '/nfts/macaco-chapeu-960.webp',
  },
  {
    date: '2026-09-15',
    dateLabel: '15 de setembro',
    readingTime: 'Leitura de 2 min',
    title: 'Como proteger sua carteira',
    excerpt: 'Proteja sua carteira, seus ativos e sua identidade.',
    art: '/nfts/macaco-fones-960.webp',
  },
] as const

export function MintJournal() {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6 md:pb-16">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <h2 id={titleId} className="text-heading tracking-wide">
          Diário da Cunhagem
        </h2>
        <p className="text-muted-foreground text-caption sm:text-body tracking-wide">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {POSTS.map((post) => {
          const size = nftArtSize(post.art)
          return (
            <li key={post.title} className="bg-card flex flex-col overflow-hidden rounded-xl">
              <article className="flex flex-1 flex-col">
                <img
                  src={post.art}
                  alt=""
                  width={size.width}
                  height={size.height}
                  loading="lazy"
                  decoding="async"
                  className="bg-muted aspect-[4/3] w-full rounded-t-xl object-cover"
                />
                <div className="flex flex-1 flex-col items-start gap-2 p-4">
                  <p className="text-muted-foreground text-caption tracking-wide">
                    <time dateTime={post.date}>{post.dateLabel}</time>
                    <span aria-hidden className="mx-2">
                      |
                    </span>
                    <span className="sr-only">, </span>
                    {post.readingTime}
                  </p>
                  <h3 className="text-body-lg font-bold">{post.title}</h3>
                  <p className="text-muted-foreground text-caption flex-1">{post.excerpt}</p>
                  <OutOfScopeAction
                    variant="link"
                    label={`Ler mais: ${post.title}`}
                    className="text-text-accent text-caption h-auto px-0 font-bold opacity-100"
                  >
                    Ler mais <span aria-hidden>→</span>
                  </OutOfScopeAction>
                </div>
              </article>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
