import Big from 'big.js'
import type { Nft, NftListParams, NftListSort, Paginated } from '@/contracts'

const DAY_MS = 86_400_000
/** Janela da aba `new`, contada a partir do NFT mais recente do catálogo (o seed tem data fixa). */
export const NEW_WINDOW_DAYS = 14
/** Fração vendida (edições limitadas) a partir da qual o NFT entra em `trending`. */
export const TRENDING_MIN_SOLD = 0.5

/** Fração vendida: edições limitadas; se só houver `open`, vale a `open`. Em [0, 1]. */
function soldRatio(nft: Nft): number {
  const limited = nft.editions.filter((e) => e.kind !== 'open')
  const editions = limited.length > 0 ? limited : nft.editions
  const total = editions.reduce((sum, e) => sum + e.total, 0)
  if (total === 0) return 0
  const available = editions.reduce((sum, e) => sum + e.available, 0)
  return (total - available) / total
}

function isTrending(nft: Nft): boolean {
  const sold = soldRatio(nft)
  return sold >= TRENDING_MIN_SOLD && sold < 1
}

/** Filtra sem ordenar. Preços comparados com big.js (nunca `Number`). */
export function filterNfts(nfts: readonly Nft[], params: NftListParams): Nft[] {
  const q = params.q?.trim().toLowerCase()
  const collections = params.collections?.length
    ? new Set(params.collections.map((c) => c.toLowerCase()))
    : null
  const min = params.priceMin === undefined ? null : new Big(params.priceMin)
  const max = params.priceMax === undefined ? null : new Big(params.priceMax)

  let newestMs = 0
  for (const nft of nfts) newestMs = Math.max(newestMs, Date.parse(nft.createdAt))
  const newSince = newestMs - NEW_WINDOW_DAYS * DAY_MS

  return nfts.filter((nft) => {
    if (q && ![nft.name, nft.collection, nft.creator, nft.description].some((f) => f.toLowerCase().includes(q))) {
      return false
    }
    if (collections && !collections.has(nft.collection.toLowerCase())) return false
    if (params.network && nft.network !== params.network) return false
    if (min && new Big(nft.price).lt(min)) return false
    if (max && new Big(nft.price).gt(max)) return false
    if (params.tab === 'new' && Date.parse(nft.createdAt) < newSince) return false
    if (params.tab === 'trending' && !isTrending(nft)) return false
    return true
  })
}

/** Ordena uma cópia; empate resolvido por `id` para a ordem ser estável. */
export function sortNfts(nfts: readonly Nft[], sort: NftListSort = 'newest'): Nft[] {
  const byId = (a: Nft, b: Nft) => a.id.localeCompare(b.id)
  const compare: Record<NftListSort, (a: Nft, b: Nft) => number> = {
    price_asc: (a, b) => new Big(a.price).cmp(b.price) || byId(a, b),
    price_desc: (a, b) => new Big(b.price).cmp(a.price) || byId(a, b),
    newest: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || byId(a, b),
  }
  return [...nfts].sort(compare[sort])
}

/** `page` fora do intervalo devolve `items: []` e mantém o `total` real. */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): Paginated<T> {
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), page, pageSize, total: items.length }
}
