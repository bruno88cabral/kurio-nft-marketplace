import type { Id, IsoDateTime } from './common'
import type { CartItem } from './cart'
import type { EthAmount } from './money'

export type CouponStatus = 'applied' | 'invalid' | 'expired'

/** Item do carrinho congelado com o preço unitário no instante da cotação. */
export interface QuoteItem extends CartItem {
  unitPrice: EthAmount
}

export interface QuoteIssue {
  nftId: Id
  edition: CartItem['edition']
  kind: 'price_changed' | 'unavailable'
}

/** `POST /quotes` (sem corpo; cota o carrinho da conta), resposta `Quote`. */
export interface Quote {
  quoteId: Id
  items: QuoteItem[]
  subtotal: EthAmount
  discount: EthAmount
  networkFee: EthAmount
  total: EthAmount
  coupon?: { code: string; status: CouponStatus }
  /** Divergências encontradas ao revalidar a cotação (preço mudou, edição esgotada). */
  issues?: QuoteIssue[]
  expiresAt: IsoDateTime
}
