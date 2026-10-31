import type { Id, IsoDateTime } from './common'
import type { EthAmount } from './money'
import type { NftEditionKind } from './nft'
import type { Network } from './wallet'

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

/** `GET /orders/:orderId`. */
export interface Order {
  id: Id
  status: OrderStatus
  /** Chave usada na criação (header `Idempotency-Key`); o recibo a exibe. */
  idempotencyKey: string
  quoteId: Id
  walletId: Id
  network: Network
  txHash?: string
  explorerUrl?: string
  items: OrderItem[]
  receipt: OrderReceipt
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/** `POST /orders` com o header `Idempotency-Key`, resposta `Order` (a mesma chave devolve o mesmo pedido). */
export interface CreateOrderRequest {
  quoteId: Id
  walletId: Id
}
