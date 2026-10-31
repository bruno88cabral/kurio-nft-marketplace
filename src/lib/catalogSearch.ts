import type { EthAmount, Network, NftListParams, NftListSort, NftListTab } from '@/contracts'
import { cmpEth, parseEth } from './eth'

/**
 * Estado do catálogo do Início na URL (search params da rota `/`). Os padrões ficam FORA da URL:
 * `tab` ausente = `all`, `sort` ausente = `newest`, `page` ausente = 1. `pageSize` não vai para a URL.
 */
export interface CatalogSearch {
  q?: string
  collections?: string[]
  priceMin?: EthAmount
  priceMax?: EthAmount
  network?: Network
  tab?: Exclude<NftListTab, 'all'>
  sort?: Exclude<NftListSort, 'newest'>
  page?: number
}

/**
 * Itens por página do catálogo (fixo, fora da URL). 12 e não os 9 (3×3) do Figma desktop: o
 * grid tem 2 colunas no mobile e 3 a partir de `md`, e 12 fecha as duas (9 deixava um card
 * sozinho na última linha em 390px).
 */
export const CATALOG_PAGE_SIZE = 12

const NETWORKS: readonly Network[] = ['ethereum', 'polygon', 'arbitrum', 'optimism']
const TABS: readonly NonNullable<CatalogSearch['tab']>[] = ['new', 'trending']
const SORTS: readonly NonNullable<CatalogSearch['sort']>[] = ['price_asc', 'price_desc']

function oneOf<T extends string>(list: readonly T[], value: unknown): T | undefined {
  return typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : undefined
}

/** O parse padrão do router transforma `0.5` em número; aceita número ou texto decimal. */
function eth(value: unknown): EthAmount | undefined {
  const raw = typeof value === 'number' && Number.isFinite(value) ? String(value) : value
  if (typeof raw !== 'string') return undefined
  try {
    return parseEth(raw.trim())
  } catch {
    return undefined
  }
}

function page(value: unknown): number | undefined {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 1 ? n : undefined
}

function collections(value: unknown): string[] | undefined {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const names = raw.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean)
  // Ordenado e sem duplicata: a mesma seleção gera a mesma URL e a mesma chave de query
  const unique = [...new Set(names)].sort((a, b) => a.localeCompare(b))
  return unique.length > 0 ? unique : undefined
}

function compact<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}

/**
 * `validateSearch` da rota `/`. Valor inválido é DESCARTADO (nunca lança), para que uma URL
 * editada à mão não chegue ao 422 do handler. Os padrões também saem da URL.
 */
export function validateCatalogSearch(search: Record<string, unknown>): CatalogSearch {
  const q = typeof search.q === 'string' ? search.q.trim() : ''
  let priceMin = eth(search.priceMin)
  let priceMax = eth(search.priceMax)
  if (priceMin !== undefined && priceMax !== undefined && cmpEth(priceMin, priceMax) > 0) {
    priceMin = undefined
    priceMax = undefined
  }
  // Toda chave sai, mesmo `undefined`: o TanStack Router mescla `{ ...buscaCrua, ...validada }`,
  // e só um `undefined` explícito apaga da busca da rota um valor inválido da URL (ex.: `page=abc`)
  return {
    q: q || undefined,
    collections: collections(search.collections),
    priceMin,
    priceMax,
    network: oneOf(NETWORKS, search.network),
    tab: oneOf(TABS, search.tab),
    sort: oneOf(SORTS, search.sort),
    page: page(search.page),
  }
}

/** Parâmetros de `GET /nfts` (e chave da query) a partir da URL: page explícita + `CATALOG_PAGE_SIZE`. */
export function toListParams(s: CatalogSearch): NftListParams {
  return compact<NftListParams>({
    q: s.q,
    collections: s.collections,
    priceMin: s.priceMin,
    priceMax: s.priceMax,
    network: s.network,
    tab: s.tab,
    sort: s.sort,
    page: s.page ?? 1,
    pageSize: CATALOG_PAGE_SIZE,
  })
}

export type CatalogFilterPatch = { [K in Exclude<keyof CatalogSearch, 'page'>]?: CatalogSearch[K] | NftListParams[K] }

/**
 * Aplica uma mudança de busca, filtro, aba ou ordenação e volta para a página 1. `undefined`
 * no patch remove o filtro. O resultado sai normalizado (mesmas regras do `validateCatalogSearch`).
 */
export function withFilter(prev: CatalogSearch, patch: CatalogFilterPatch): CatalogSearch {
  return validateCatalogSearch({ ...prev, ...patch, page: undefined })
}

/** Patch que limpa os filtros da sidebar (coleções, rede, preço); busca, aba e ordenação ficam. */
export const CLEAR_SIDEBAR_FILTERS: CatalogFilterPatch = {
  collections: undefined,
  network: undefined,
  priceMin: undefined,
  priceMax: undefined,
}

/** Total de páginas (no mínimo 1, para o "Página não existe" apontar para uma página real). */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

export type PageItem = number | 'ellipsis'

/**
 * Itens da paginação: todas as páginas até 7; acima disso, primeira, última e vizinhas da atual,
 * com reticências nos buracos (um buraco de uma página só mostra a página, não as reticências).
 */
export function pageItems(page: number, count: number): PageItem[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const pages = [...new Set([1, page - 1, page, page + 1, count])]
    .filter((p) => p >= 1 && p <= count)
    .sort((a, b) => a - b)
  const items: PageItem[] = []
  for (const p of pages) {
    const prev = items.at(-1)
    if (typeof prev === 'number' && p - prev === 2) items.push(prev + 1)
    else if (typeof prev === 'number' && p - prev > 2) items.push('ellipsis')
    items.push(p)
  }
  return items
}

/** Quantidade exibida em "Filtros (n)": cada coleção, a rede e a faixa de preço (uma só). */
export function activeFilterCount(s: CatalogSearch): number {
  return (
    (s.collections?.length ?? 0) +
    (s.network ? 1 : 0) +
    (s.priceMin !== undefined || s.priceMax !== undefined ? 1 : 0)
  )
}
