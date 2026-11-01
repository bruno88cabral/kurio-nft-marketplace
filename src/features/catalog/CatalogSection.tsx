import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useId } from 'react'
import { featuredNftsQuery } from '@/api/nfts'
import type { NftListTab } from '@/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { nftArtSize } from '@/lib/nftArt'
import { CatalogFilters } from './CatalogFilters'
import { CatalogGrid } from './CatalogGrid'
import { CatalogToolbar } from './CatalogToolbar'
import { useCatalogSearch } from './useCatalogSearch'

/** Âncora do "Mercado" (header e tab bar) e do EXPLORAR do hero. */
const CATALOG_ANCHOR_ID = 'catalogo'

/**
 * Catálogo do Início: sidebar de filtros (lg+) + abas/ordenação + grade paginada. Abaixo de `lg`
 * os filtros vão para o drawer, aberto pela toolbar (`md` a `lg`) ou pelo botão ao lado da busca
 * no topo da página (abaixo de `md`, `CatalogMobileTopBar`).
 */
export function CatalogSection() {
  const { search, update } = useCatalogSearch()
  const titleId = useId()
  const tab: NftListTab = search.tab ?? 'all'

  return (
    <section
      id={CATALOG_ANCHOR_ID}
      aria-labelledby={titleId}
      // scroll-mt: o header é sticky (h-16)
      className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 pt-2 pb-10 md:px-6 md:pt-10"
    >
      <h2 id={titleId} className="sr-only">
        Catálogo
      </h2>
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[16.5rem_minmax(0,1fr)]">
        {/* Sem título visível (Figma): o painel começa em "Coleções"; o nome fica no aria-label */}
        <aside aria-label="Filtros" className="hidden flex-col gap-6 lg:flex">
          <div className="bg-card p-5">
            <CatalogFilters />
          </div>
          <FeaturedSpotlight />
        </aside>
        <Tabs
          value={tab}
          onValueChange={(value) => update({ tab: value as NftListTab })}
          className="min-w-0 gap-6"
        >
          <CatalogToolbar />
          {/* Um painel só, com o valor da aba ativa: a grade não remonta ao trocar de aba, então o
              keepPreviousData mantém os cards anteriores (esmaecidos) em vez de voltar ao skeleton */}
          <TabsContent value={tab}>
            <CatalogGrid />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}

/**
 * "NFT em destaque / Oferta limitada" abaixo dos filtros (Figma): títulos e a arte grande do
 * primeiro item de `featured`, sem nome nem preço visíveis; a arte leva ao Detalhe.
 */
function FeaturedSpotlight() {
  const featured = useQuery(featuredNftsQuery())
  const titleId = useId()
  const first = featured.data?.[0]
  if (featured.isError || (featured.data && !first)) return null

  return (
    <section aria-labelledby={titleId} className="bg-card flex flex-col overflow-hidden rounded-b-2xl">
      <h3 id={titleId} className="flex flex-col gap-1 px-5 pt-5 pb-3">
        <span className="text-text-accent text-heading uppercase">NFT em destaque</span>
        <span className="text-foreground text-body-lg self-center font-bold tracking-wide uppercase">
          Oferta limitada
        </span>
      </h3>
      {first ? (
        <Link
          to="/nfts/$nftId"
          params={{ nftId: first.id }}
          className="focus-visible:ring-ring block overflow-hidden rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-inset"
        >
          <img
            src={first.imageUrl}
            alt=""
            width={nftArtSize(first.imageUrl).width}
            height={nftArtSize(first.imageUrl).height}
            loading="lazy"
            decoding="async"
            className="bg-muted aspect-square w-full object-cover"
          />
          <span className="sr-only">{first.name}</span>
        </Link>
      ) : (
        <Skeleton aria-hidden className="aspect-square w-full rounded-2xl" />
      )}
    </section>
  )
}
