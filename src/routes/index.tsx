import { createFileRoute } from '@tanstack/react-router'
import { featuredNftsQuery, nftFacetsQuery, nftListQuery } from '@/api/nfts'
import { CatalogSection } from '@/features/catalog/CatalogSection'
import { HeroFeatured } from '@/features/catalog/HeroFeatured'
import { MintJournal } from '@/features/catalog/MintJournal'
import { PromoCards } from '@/features/catalog/PromoCards'
import { toListParams, validateCatalogSearch } from '@/lib/catalogSearch'

export const Route = createFileRoute('/')({
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => toListParams(search),
  // Só prefetch, sem await: uma falha da API não derruba a rota inteira (o erro aparece só na
  // área do grid, com retry), e a troca de filtro não espera o loader. Com `defaultPreload:
  // 'intent'`, o hover num link para `/` já aquece o cache.
  loader: ({ context: { queryClient }, deps }) => {
    void queryClient.prefetchQuery(featuredNftsQuery())
    void queryClient.prefetchQuery(nftFacetsQuery())
    void queryClient.prefetchQuery(nftListQuery(deps))
  },
  head: () => ({ meta: [{ title: 'Início · Kurio' }] }),
  component: HomePage,
})

function HomePage() {
  return (
    <div className="flex flex-col">
      <HeroFeatured />
      <CatalogSection />
      <PromoCards />
      <MintJournal />
    </div>
  )
}
