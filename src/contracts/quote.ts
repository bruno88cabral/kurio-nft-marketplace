import type { Id, IsoDateTime } from './common'
import type { EthAmount } from './money'

export type CouponStatus = 'applied' | 'invalid' | 'expired'

export interface Quote {
  quoteId: Id
  subtotal: EthAmount
  discount: EthAmount
  networkFee: EthAmount
  total: EthAmount
  coupon?: { code: string; status: CouponStatus }
  expiresAt: IsoDateTime
}
