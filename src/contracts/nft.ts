import type { Id, Quantity } from './common'
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
  collection: string // TODO M3: virar entidade própria se a UI precisar
  network: Network
  price: EthAmount
  editions: NftEdition[]
}

export type NftListTab = 'all' | 'new' | 'trending'

export type NftListSort = 'price_asc' | 'price_desc' | 'newest' // TODO M3: confirmar opções de ordenação

/** Os nomes dos campos viram os search params do TanStack Router no M2. */
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
