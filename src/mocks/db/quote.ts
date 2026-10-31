import type { CouponStatus, EthAmount, Id, Quote, QuoteIssue, QuoteItem } from '@/contracts'
import { addEth, mulEth, parseEth, percentEth, subEth } from '@/lib/eth'
import { COUPONS, NETWORK_FEE } from '../fixtures/collections'
import type { ScenarioRules } from '../scenarios'
import { invalid } from './domainError'
import { newId } from './ids'
import type { MockDb, StoredQuote } from './schema'
import type { Touch } from './store'

export const QUOTE_TTL_MS = 5 * 60_000

/** O cenário (`couponOutcome`) vence o código; código desconhecido é `invalid`, `EXPIRED5` é `expired`. */
export function couponStatus(code: string, rules?: ScenarioRules): { status: CouponStatus; percentOff: number } {
  if (rules?.couponOutcome) return { status: rules.couponOutcome, percentOff: 0 }
  const coupon = COUPONS[code]
  if (!coupon) return { status: 'invalid', percentOff: 0 }
  if (coupon.expired) return { status: 'expired', percentOff: 0 }
  return { status: 'applied', percentOff: coupon.percentOff }
}

/** Cota o carrinho da conta, congela os preços e grava o snapshot em `db.quotes`. */
export function buildQuote(
  db: MockDb,
  touch: Touch,
  accountId: Id,
  rules: ScenarioRules | undefined,
  now: Date,
): Quote {
  const cart = db.carts[accountId]
  if (!cart || cart.items.length === 0) throw invalid('O carrinho está vazio.')

  const items: QuoteItem[] = []
  const issues: QuoteIssue[] = []
  for (const line of cart.items) {
    const nft = db.nfts[line.nftId]
    const edition = nft?.editions.find((e) => e.kind === line.edition)
    if (!nft || !edition || edition.available < line.quantity) {
      issues.push({ nftId: line.nftId, edition: line.edition, kind: 'unavailable' })
    }
    // NFT fora do catálogo: sem preço para congelar, a linha fica de fora (e sinalizada)
    if (nft) items.push({ ...line, unitPrice: nft.price })
  }

  const subtotal = addEth(parseEth('0'), ...items.map((i) => mulEth(i.unitPrice, i.quantity)))
  let discount: EthAmount = parseEth('0')
  let coupon: Quote['coupon']
  if (cart.couponCode) {
    const { status, percentOff } = couponStatus(cart.couponCode, rules)
    coupon = { code: cart.couponCode, status }
    if (status === 'applied') discount = percentEth(subtotal, percentOff)
  }
  const networkFee = NETWORK_FEE
  const total = addEth(subEth(subtotal, discount), networkFee)

  const quote: Quote = {
    quoteId: newId(),
    items,
    subtotal,
    discount,
    networkFee,
    total,
    ...(coupon ? { coupon } : {}),
    ...(issues.length > 0 ? { issues } : {}),
    expiresAt: new Date(now.getTime() + QUOTE_TTL_MS).toISOString(),
  }
  const stored: StoredQuote = { ...quote, accountId }
  db.quotes[quote.quoteId] = stored
  touch('quote', quote.quoteId)
  return quote
}
