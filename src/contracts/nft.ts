import type { Id, IsoDateTime, Quantity } from './common'
import type { EthAmount } from './money'
import type { Network } from './wallet'

export type NftEditionKind = '1/1' | '1/10' | '1/50' | 'open'

export interface NftEdition {
  kind: NftEditionKind
  /** Unidades ainda disponíveis (inteiro). Em `open`, o limite é definido pelo servidor. */
  available: Quantity
  total: Quantity
}

export interface Nft {
  id: Id
  name: string
  imageUrl: string
  /** Galeria; `images[0]` é a capa (mesmo valor de `imageUrl`). Nunca vazio. */
  images: string[]
  collection: string // TODO M3: virar entidade própria se a UI precisar
  description: string
  creator: string
  network: Network
  price: EthAmount
  /** Preço "de" exibido riscado no card (promoção). Ausente na maioria. */
  previousPrice?: EthAmount
  editions: NftEdition[]
  createdAt: IsoDateTime
  featured: boolean
}

export type NftListTab = 'all' | 'new' | 'trending'

export type NftListSort = 'price_asc' | 'price_desc' | 'newest'

/** `GET /nfts` (query = `NftListParams`, resposta `Paginated<Nft>`) e `GET /nfts/:nftId` (resposta `Nft`). Os nomes dos campos viram os search params do TanStack Router no M2. */
export interface NftListParams {
  q?: string
  collections?: string[]
  priceMin?: EthAmount
  priceMax?: EthAmount
  network?: Network
  tab?: NftListTab
  sort?: NftListSort
  page?: number
  pageSize?: number
}

/** `GET /nfts/facets`: contagens sobre o catálogo inteiro (não dependem dos filtros aplicados). */
export interface NftFacets {
  collections: Array<{ name: string; count: Quantity }>
  networks: Array<{ network: Network; count: Quantity }>
  price: { min: EthAmount; max: EthAmount }
}
