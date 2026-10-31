import { useId } from 'react'
import { OutOfScopeAction } from '@/components/kurio'
import { nftArtSize } from '@/lib/nftArt'

/**
 * "Diário da Cunhagem" (blog do Figma `2:2`). A página editorial está fora do escopo (§3): o bloco
 * existe pela fidelidade visual, com textos de layout (não são dados de negócio) e "Ler mais" no
 * padrão `OutOfScopeAction`. As imagens são as artes do kit.
 */
const POSTS = [
  {
    date: '2026-10-24',
    dateLabel: '24 out 2026',
    title: 'Como escolher a edição certa: 1/1, 1/10, 1/50 ou aberta',
    excerpt: 'Raridade, preço e liquidez mudam com o tamanho da tiragem. Um guia rápido antes da primeira compra.',
    art: '/nfts/origami-orbit.svg',
  },
  {
    date: '2026-10-17',
    dateLabel: '17 out 2026',
    title: 'Por dentro do ateliê de Pixel Reefs',
    excerpt: 'Tomo Kitano conta como recifes de 8 bits viraram uma das coleções mais procuradas do mês.',
    art: '/nfts/reef-pulse.svg',
  },
  {
    date: '2026-10-09',
    dateLabel: '09 out 2026',
    title: 'Taxa de rede sem susto',
    excerpt: 'O que entra no total do pedido e por que a taxa aparece como estimada até a confirmação.',
    art: '/nfts/night-compass.svg',
  },
] as const

export function MintJournal() {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6 md:pb-16">
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-text-accent text-caption font-bold tracking-widest uppercase">Blog</p>
        <h2 id={titleId} className="text-heading">
          Diário da Cunhagem
        </h2>
      </div>
      <ul className="grid gap-4 md:grid-cols-3 md:gap-6">
        {POSTS.map((post) => {
          const size = nftArtSize(post.art)
          return (
            <li key={post.title} className="bg-card ring-border flex flex-col overflow-hidden rounded-xl ring-1">
              <article className="flex flex-1 flex-col">
                <img
                  src={post.art}
                  alt=""
                  width={size.width}
                  height={size.height}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[16/9] w-full object-cover"
                />
                <div className="flex flex-1 flex-col items-start gap-2 p-4">
                  <time dateTime={post.date} className="text-muted-foreground text-tiny uppercase">
                    {post.dateLabel}
                  </time>
                  <h3 className="text-body font-medium">{post.title}</h3>
                  <p className="text-muted-foreground text-caption flex-1">{post.excerpt}</p>
                  <OutOfScopeAction variant="link" label={`Ler mais: ${post.title}`} className="text-text-accent h-auto px-0">
                    Ler mais
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
