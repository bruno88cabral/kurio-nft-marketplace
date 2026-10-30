import type { Id, IsoDateTime } from './common'
import type { EthAmount } from './money'
import type { NftEditionKind } from './nft'

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface OrderItem {
  nftId: Id
  name: string
  edition: NftEditionKind
  quantity: number
  unitPrice: EthAmount
}

/** Snapshot imutável do que foi cobrado no momento do pedido. */
export interface OrderReceipt {
  items: OrderItem[]
  subtotal: EthAmount
  discount: EthAmount
  networkFee: EthAmount
  total: EthAmount
}

export interface Order {
  id: Id
  status: OrderStatus
  idempotencyKey: string
  quoteId: Id
  items: OrderItem[]
  receipt: OrderReceipt
  createdAt: IsoDateTime
}

export interface CreateOrderRequest {
  idempotencyKey: string
  quoteId: Id
  walletId: Id
}
