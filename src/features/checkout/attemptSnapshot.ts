import type { CouponStatus, EthAmount, Id, NftEditionKind, Quote, QuoteItem } from '@/contracts'

/**
 * O que a tentativa de pedido compra: itens e valores da cotação enviada (`attempt.quoteId`). Só serve para
 * **mostrar** a tentativa pendente na Revisão e no resumo; nunca entra no corpo do `POST /orders` nem na chave.
 * Os valores vêm da cotação (o cliente não soma).
 */
export interface AttemptSnapshot {
  /** A cotação de onde saíram os valores; o snapshot só vale com a tentativa do mesmo `quoteId`. */
  quoteId: Id
  items: QuoteItem[]
  subtotal: EthAmount
  discount: EthAmount
  networkFee: EthAmount
  total: EthAmount
  coupon?: { code: string; status: CouponStatus }
}

/** Copia da cotação revisada e enviada só o que a tela mostra. Nenhum valor é calculado. */
export function attemptSnapshotOf(quote: Quote): AttemptSnapshot {
  const snapshot: AttemptSnapshot = {
    quoteId: quote.quoteId,
    items: quote.items.map(({ nftId, edition, quantity, unitPrice }) => ({ nftId, edition, quantity, unitPrice })),
    subtotal: quote.subtotal,
    discount: quote.discount,
    networkFee: quote.networkFee,
    total: quote.total,
  }
  if (quote.coupon) snapshot.coupon = { code: quote.coupon.code, status: quote.coupon.status }
  return snapshot
}

const EDITIONS: readonly NftEditionKind[] = ['1/1', '1/10', '1/50', 'open']
const COUPON_STATUSES: readonly CouponStatus[] = ['applied', 'invalid', 'expired']
const DECIMAL = /^\d+(\.\d+)?$/

const isString = (value: unknown): value is string => typeof value === 'string' && value !== ''
const isEth = (value: unknown): value is EthAmount => typeof value === 'string' && DECIMAL.test(value)

function parseItem(value: unknown): QuoteItem | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { nftId, edition, quantity, unitPrice } = value as Record<string, unknown>
  if (!isString(nftId) || !EDITIONS.includes(edition as NftEditionKind)) return undefined
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || !isEth(unitPrice)) return undefined
  return { nftId, edition: edition as NftEditionKind, quantity, unitPrice }
}

/** O snapshot guardado no rascunho, validado campo a campo; qualquer coisa malformada vira `undefined`. */
export function parseAttemptSnapshot(value: unknown): AttemptSnapshot | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const raw = value as Record<string, unknown>
  if (!isString(raw.quoteId) || !Array.isArray(raw.items) || raw.items.length === 0) return undefined
  const items: QuoteItem[] = []
  for (const entry of raw.items) {
    const item = parseItem(entry)
    if (!item) return undefined
    items.push(item)
  }
  const { subtotal, discount, networkFee, total, coupon } = raw
  if (!isEth(subtotal) || !isEth(discount) || !isEth(networkFee) || !isEth(total)) return undefined
  const snapshot: AttemptSnapshot = { quoteId: raw.quoteId, items, subtotal, discount, networkFee, total }
  if (coupon !== undefined) {
    if (typeof coupon !== 'object' || coupon === null) return undefined
    const { code, status } = coupon as Record<string, unknown>
    if (!isString(code) || !COUPON_STATUSES.includes(status as CouponStatus)) return undefined
    snapshot.coupon = { code, status: status as CouponStatus }
  }
  return snapshot
}
