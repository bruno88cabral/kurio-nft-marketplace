/** Fixtures de NFT/facetas para os testes do catálogo (sem passar pelo mock server). */
import type { Nft, NftFacets, Paginated } from '@/contracts'
import { parseEth } from '@/lib/eth'

export function makeNft(n: number, over: Partial<Nft> = {}): Nft {
  const art = `/nfts/solar-veil.svg`
  return {
    id: `nft-${String(n).padStart(3, '0')}`,
    name: `Obra ${n}`,
    imageUrl: art,
    images: [art],
    collection: 'Coleção A',
    description: '',
    creator: 'Artista',
    network: 'ethereum',
    price: parseEth('0.35'),
    editions: [{ kind: '1/10', available: 5, total: 10 }],
    createdAt: '2026-01-01T00:00:00.000Z',
    featured: false,
    ...over,
  }
}

export function makePage(items: Nft[], over: Partial<Paginated<Nft>> = {}): Paginated<Nft> {
  return { items, total: items.length, page: 1, pageSize: 12, ...over }
}

export const FACETS: NftFacets = {
  collections: [
    { name: 'Coleção A', count: 7 },
    { name: 'Coleção B', count: 3 },
  ],
  networks: [
    { network: 'ethereum', count: 6 },
    { network: 'polygon', count: 4 },
  ],
  price: { min: parseEth('0.1'), max: parseEth('2') },
}

type Handler = (config?: { params?: unknown }) => unknown
/** `apiClient.get` por rota: `list` (`/nfts`), `featured`, `facets`. Cada um devolve o corpo ou rejeita/lança. */
export function nftApiGet(handlers: { list?: Handler; featured?: Handler; facets?: Handler }) {
  return async (url: string, config?: { params?: unknown }) => {
    const handler = url === '/nfts' ? handlers.list : url === '/nfts/featured' ? handlers.featured : url === '/nfts/facets' ? handlers.facets : undefined
    if (!handler) throw new Error(`rota sem handler: ${url}`)
    return { data: await handler(config) }
  }
}
