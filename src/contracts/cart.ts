import type { Id } from './common'
import type { NftEditionKind } from './nft'

export interface CartItem {
  nftId: Id
  edition: NftEditionKind
  quantity: number
}

/** `GET /cart`. */
export interface Cart {
  items: CartItem[]
  couponCode?: string
}

/** `POST /cart/items`, resposta `Cart`. */
export interface AddCartItemRequest {
  nftId: Id
  edition: NftEditionKind
  quantity: number
}

/** `PATCH /cart/items/:nftId/:edition`, resposta `Cart`. `DELETE` no mesmo caminho remove o item. */
export interface UpdateCartItemRequest {
  quantity: number
}

/** `POST /cart/merge` (carrinho anônimo do cliente entra no da conta após o login), resposta `Cart`. */
export interface MergeCartRequest {
  items: CartItem[]
}

/** `PUT /cart/coupon`, resposta `Cart`. `DELETE /cart/coupon` remove o cupom. */
export interface ApplyCouponRequest {
  code: string
}
