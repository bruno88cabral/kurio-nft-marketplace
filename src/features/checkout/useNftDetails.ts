import { useQueries } from '@tanstack/react-query'
import { nftDetailQuery } from '@/api/nfts'
import type { Id, Nft } from '@/contracts'

/**
 * Nome e arte dos NFTs da Revisão (`nftDetailQuery`, o mesmo cache do Detalhe), uma query por `nftId` distinto.
 * Devolve a busca por `nftId`; `undefined` enquanto carrega (a linha mostra skeleton).
 */
export function useNftDetails(nftIds: readonly Id[]): (nftId: Id) => Nft | undefined {
  const ids = [...new Set(nftIds)]
  const details = useQueries({ queries: ids.map((nftId) => nftDetailQuery(nftId)) })
  return (nftId) => details[ids.indexOf(nftId)]?.data
}
