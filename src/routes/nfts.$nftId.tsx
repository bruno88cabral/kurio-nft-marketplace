import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/nfts/$nftId')({
  head: () => ({ meta: [{ title: 'Detalhe do NFT · Kurio' }] }),
  component: NftDetailPage,
})

function NftDetailPage() {
  const { nftId } = Route.useParams()
  return <h1>Detalhe do NFT {nftId}</h1>
}
