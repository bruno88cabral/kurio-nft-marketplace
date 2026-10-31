import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute, notFound, useRouter } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'
import { useState } from 'react'
import { nftDetailQuery } from '@/api/nfts'
import { ApiError, type NftEditionKind } from '@/contracts'
import { EmptyState, ErrorState } from '@/components/kurio'
import { buttonVariants } from '@/components/ui/button'
import { isEditionKind } from '@/features/nft-detail/edition'
import { DETAIL_ASIDE_CLASS, DETAIL_GRID_CLASS, DETAIL_PAGE_CLASS } from '@/features/nft-detail/layout'
import { MobilePurchaseBar, MobileScreenHeader } from '@/features/nft-detail/MobileDetailChrome'
import { MoreFromCollection } from '@/features/nft-detail/MoreFromCollection'
import { NftDetailSkeleton } from '@/features/nft-detail/NftDetailSkeleton'
import { NftGallery } from '@/features/nft-detail/NftGallery'
import { NftBreadcrumb, NftDescription, NftInfo } from '@/features/nft-detail/NftInfo'
import { PurchasePanel } from '@/features/nft-detail/PurchasePanel'

interface NftDetailSearch {
  edition?: NftEditionKind
}

export const Route = createFileRoute('/nfts/$nftId')({
  // A chave volta mesmo inválida: o router mescla o search cru com o validado
  validateSearch: (search: Record<string, unknown>): NftDetailSearch => ({
    edition: isEditionKind(search.edition) ? search.edition : undefined,
  }),
  loader: async ({ context: { queryClient }, params }) => {
    try {
      return await queryClient.ensureQueryData(nftDetailQuery(params.nftId))
    } catch (error) {
      if (error instanceof ApiError && error.code === 'not_found') throw notFound()
      throw error
    }
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData ? `${loaderData.name} · Kurio` : 'NFT · Kurio' }] }),
  // pendingMs/pendingMinMs padrão do router (1000/500): o `slow` (4s) mostra o skeleton e o
  // `default` (resposta em ms) não pisca. Ver ARCHITECTURE.md › "Cache" (loader do Detalhe).
  pendingComponent: NftDetailSkeleton,
  notFoundComponent: NftNotFound,
  errorComponent: NftDetailError,
  component: NftDetailPage,
})

function NftDetailPage() {
  const { nftId } = Route.useParams()
  const { edition } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: nft } = useSuspenseQuery(nftDetailQuery(nftId))

  return (
    <div className={DETAIL_PAGE_CLASS}>
      <MobileScreenHeader title={nft.name} className="-mx-2" />
      <NftBreadcrumb nft={nft} className="hidden md:block" />
      <div className={DETAIL_GRID_CLASS}>
        <NftGallery key={nft.id} nft={nft} />
        <div className={DETAIL_ASIDE_CLASS}>
          <NftInfo nft={nft} />
          <PurchasePanel
            key={nft.id}
            nft={nft}
            requestedEdition={edition}
            onEditionChange={(kind) =>
              void navigate({ search: (prev) => ({ ...prev, edition: kind }), replace: true, resetScroll: false })
            }
          />
          <NftDescription description={nft.description} />
        </div>
      </div>
      <MoreFromCollection nft={nft} className="mt-4" />
      <MobilePurchaseBar nft={nft} />
    </div>
  )
}

function NftNotFound() {
  return (
    <>
      <title>NFT não encontrado · Kurio</title>
      <div className="mx-auto w-full max-w-xl px-4 py-16">
        <EmptyState
          icon={<SearchX />}
          title="NFT não encontrado"
          description="Este NFT não existe ou foi removido do catálogo."
          action={
            <Link to="/" className={buttonVariants({ variant: 'default' })}>
              Voltar ao Início
            </Link>
          }
        />
      </div>
    </>
  )
}

function NftDetailError() {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16">
      <ErrorState
        title="Não foi possível carregar o NFT."
        description="Verifique sua conexão e tente de novo."
        retrying={retrying}
        onRetry={() => {
          setRetrying(true)
          void router.invalidate().finally(() => setRetrying(false))
        }}
      />
    </div>
  )
}
