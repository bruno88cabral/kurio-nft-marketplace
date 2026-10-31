import { http, HttpResponse } from 'msw'
import { API_URL } from '@/app/env'
import type { Network, Nft, NftListParams, NftListSort, NftListTab, Paginated } from '@/contracts'
import { store } from '../runtime'
import { notFound, validationError, raise } from './errors'
import { filterNfts, paginate, sortNfts } from './nftQuery'
import { withScenario } from './withScenario'

const NETWORKS: readonly Network[] = ['ethereum', 'polygon', 'arbitrum', 'optimism']
const TABS: readonly NftListTab[] = ['all', 'new', 'trending']
const SORTS: readonly NftListSort[] = ['price_asc', 'price_desc', 'newest']
const DECIMAL = /^\d+(\.\d+)?$/
export const DEFAULT_PAGE_SIZE = 12
export const MAX_PAGE_SIZE = 100

function oneOf<T extends string>(list: readonly T[], value: string | null): T | undefined {
  return value !== null && (list as readonly string[]).includes(value) ? (value as T) : undefined
}

function positiveInt(value: string | null): number | undefined {
  return value !== null && /^\d+$/.test(value) && Number(value) >= 1 ? Number(value) : undefined
}

/** `collections` aceita repetição (`collections=a&collections=b`) ou lista separada por vírgula. */
function parseParams(url: URL): { params: NftListParams } | { errors: Record<string, string> } {
  const sp = url.searchParams
  const errors: Record<string, string> = {}
  const params: NftListParams = {}

  const q = sp.get('q')
  if (q) params.q = q
  const collections = sp.getAll('collections').flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean)
  if (collections.length > 0) params.collections = collections

  for (const key of ['priceMin', 'priceMax'] as const) {
    const raw = sp.get(key)
    if (raw === null || raw === '') continue
    if (DECIMAL.test(raw)) params[key] = raw as NftListParams['priceMin']
    else errors[key] = 'Informe um valor decimal em ETH.'
  }

  for (const [key, list] of [['network', NETWORKS], ['tab', TABS], ['sort', SORTS]] as const) {
    const raw = sp.get(key)
    if (raw === null || raw === '') continue
    const value = oneOf<string>(list, raw)
    if (value) Object.assign(params, { [key]: value })
    else errors[key] = `Valor inválido. Use: ${list.join(', ')}.`
  }

  for (const [key, max] of [['page', Infinity], ['pageSize', MAX_PAGE_SIZE]] as const) {
    const raw = sp.get(key)
    if (raw === null || raw === '') continue
    const value = positiveInt(raw)
    if (value !== undefined && value <= max) params[key] = value
    else errors[key] = `Informe um inteiro entre 1 e ${max === Infinity ? 'o limite' : max}.`
  }

  return Object.keys(errors).length > 0 ? { errors } : { params }
}

const catalog = (): Nft[] => Object.values(store.getDb().nfts)

export const nftHandlers = [
  http.get(
    `${API_URL}/nfts`,
    withScenario('GET', '/nfts', ({ request }) => {
      const parsed = parseParams(new URL(request.url))
      if ('errors' in parsed) raise(validationError(parsed.errors, 'Parâmetros de busca inválidos.'))
      const { params } = parsed
      const items = sortNfts(filterNfts(catalog(), params), params.sort)
      return HttpResponse.json<Paginated<Nft>>(paginate(items, params.page ?? 1, params.pageSize ?? DEFAULT_PAGE_SIZE))
    }),
  ),

  // Antes de `/nfts/:nftId`, senão `featured` seria lido como id
  http.get(
    `${API_URL}/nfts/featured`,
    withScenario('GET', '/nfts/featured', () =>
      HttpResponse.json<Nft[]>(sortNfts(catalog().filter((n) => n.featured))),
    ),
  ),

  http.get(
    `${API_URL}/nfts/:nftId`,
    withScenario('GET', '/nfts/:nftId', ({ params }) => {
      const nft = store.getDb().nfts[String(params.nftId)]
      if (!nft) raise(notFound('NFT não encontrado.'))
      return HttpResponse.json<Nft>(nft)
    }),
  ),

  // Nomes das coleções presentes no catálogo (não há entidade própria ainda; ver `Nft.collection`)
  http.get(
    `${API_URL}/collections`,
    withScenario('GET', '/collections', () =>
      HttpResponse.json<string[]>([...new Set(catalog().map((n) => n.collection))].sort()),
    ),
  ),
]
