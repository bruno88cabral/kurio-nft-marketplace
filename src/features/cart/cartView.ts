import type { CartItem, CouponStatus, Quote, QuoteIssue } from '@/contracts'
import type { CouponInputStatus } from '@/components/kurio'

export const lineKey = (item: Pick<CartItem, 'nftId' | 'edition'>) => `${item.nftId}:${item.edition}`

/** Divergências da cotação por linha (`nftId:edition`). `unavailable` vale mais que `price_changed`. */
export function issuesByLine(issues: readonly QuoteIssue[] | undefined): Map<string, QuoteIssue['kind']> {
  const map = new Map<string, QuoteIssue['kind']>()
  for (const issue of issues ?? []) {
    const key = lineKey(issue)
    if (map.get(key) !== 'unavailable') map.set(key, issue.kind)
  }
  return map
}

export interface CouponStatusInput {
  /** Aplicar ou remover em andamento. */
  submitting: boolean
  /** Código gravado no carrinho (`Cart.couponCode`). */
  couponCode: string | undefined
  quote: Pick<Quote, 'coupon'> | undefined
  quoteError: boolean
}

/**
 * Status do `CouponInput`. O `PUT /cart/coupon` só guarda o código: `applied`/`invalid`/`expired` só existe na
 * cotação feita com esse código. Enquanto a cotação ainda não trouxe o código gravado, é `applying`
 * (sem isso, o campo piscaria vazio entre o PUT e a cotação nova).
 */
export function couponStatus({ submitting, couponCode, quote, quoteError }: CouponStatusInput): CouponInputStatus {
  if (submitting) return 'applying'
  if (!couponCode) return 'idle'
  const coupon = quote?.coupon
  if (coupon && coupon.code.toUpperCase() === couponCode.toUpperCase()) return coupon.status satisfies CouponStatus
  return quoteError ? 'idle' : 'applying'
}

/** Nome acessível do link do carrinho: "Carrinho" ou "Carrinho, N itens" (soma das quantidades). */
export function cartLinkLabel(totalQuantity: number): string {
  if (totalQuantity <= 0) return 'Carrinho'
  return `Carrinho, ${totalQuantity} ${totalQuantity === 1 ? 'item' : 'itens'}`
}
