import { useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { featuredNftsQuery } from '@/api/nfts'
import type { NftListTab } from '@/contracts'
import { NftCard, NftCardSkeleton } from '@/components/kurio'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { CatalogFilters } from './CatalogFilters'
import { CatalogGrid } from './CatalogGrid'
import { CatalogToolbar } from './CatalogToolbar'
import { useCatalogSearch } from './useCatalogSearch'

/** Âncora do "Mercado" (header e tab bar) e do EXPLORAR do hero. */
const CATALOG_ANCHOR_ID = 'catalogo'

/**
 * Catálogo do Início: sidebar de filtros (lg+) + abas/ordenação + grade paginada. Abaixo de `lg`
 * os filtros vão para o drawer aberto pela toolbar.
 */
export function CatalogSection() {
  const { search, update } = useCatalogSearch()
  const titleId = useId()
  const filtersId = useId()
  const tab: NftListTab = search.tab ?? 'all'

  return (
    <section
      id={CATALOG_ANCHOR_ID}
      aria-labelledby={titleId}
      // scroll-mt: o header é sticky (h-16)
      className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-10 md:px-6"
    >
      <h2 id={titleId} className="sr-only">
        Catálogo
      </h2>
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[16.5rem_minmax(0,1fr)]">
        <aside aria-labelledby={filtersId} className="hidden flex-col gap-8 lg:flex">
          <div className="bg-card ring-border flex flex-col gap-5 rounded-xl p-5 ring-1">
            <h3 id={filtersId} className="text-body-lg font-bold">
              Filtros
            </h3>
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

/** Card "NFT em destaque / Oferta limitada" abaixo dos filtros: o primeiro item de `featured`. */
function FeaturedSpotlight() {
  const featured = useQuery(featuredNftsQuery())
  const first = featured.data?.[0]
  if (featured.isError || (featured.data && !first)) return null

  return (
    <div className="flex flex-col gap-3">
      <p className="text-text-accent text-caption font-bold tracking-widest uppercase">NFT em destaque</p>
      {first ? (
        <NftCard nft={first} previousPrice={first.previousPrice} badge="Oferta limitada" />
      ) : (
        <NftCardSkeleton />
      )}
    </div>
  )
}
