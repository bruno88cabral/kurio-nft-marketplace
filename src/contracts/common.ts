export type Id = string

/** Quantidade inteira (contagem, página, versão). Nunca valor em ETH, que é `EthAmount`. */
export type Quantity = number

/** Data/hora ISO 8601 (ex.: "2026-10-30T18:42:02.522Z"). */
export type IsoDateTime = string

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: Quantity
}
