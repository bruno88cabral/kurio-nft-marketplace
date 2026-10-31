import type { CreateOrderRequest, Id, Order, OrderItem, Wallet } from '@/contracts'
import { addEth, parseEth } from '@/lib/eth'
import type { ScenarioRules } from '../scenarios'
import { conflict, forbidden, missing } from './domainError'
import { newId } from './ids'
import type { MockDb, StoredOrder, StoredQuote } from './schema'
import type { Touch } from './store'

export interface CreateOrderInput {
  accountId: Id
  idempotencyKey: string
  body: CreateOrderRequest
  now: Date
}

export interface CreateOrderResult {
  order: StoredOrder
  /** `false` quando a mesma chave devolveu um pedido já existente (o handler responde 200). */
  created: boolean
}

/** A chave é escopada por conta: a mesma string em contas diferentes não colide. */
export const idempotencyId = (accountId: Id, key: string) => `${accountId}:${key}`

export function fingerprintOf(accountId: Id, body: CreateOrderRequest): string {
  // Ordem de chaves fixa: o mesmo payload gera sempre a mesma string
  return JSON.stringify({ accountId, quoteId: body.quoteId, walletId: body.walletId })
}

function findWallet(db: MockDb, walletId: Id): { ownerId: Id; wallet: Wallet } | null {
  for (const [ownerId, wallets] of Object.entries(db.wallets)) {
    const wallet = wallets.find((w) => w.id === walletId)
    if (wallet) return { ownerId, wallet }
  }
  return null
}

function ownedQuote(db: MockDb, accountId: Id, quoteId: Id): StoredQuote {
  const quote = db.quotes[quoteId]
  if (!quote) throw missing('Cotação não encontrada.')
  if (quote.accountId !== accountId) throw forbidden('Esta cotação pertence a outra conta.')
  return quote
}

/**
 * `price-changed` / `sold-out`: o NFT muda DEPOIS da cotação. Roda num `mutate` próprio e ANTES do
 * `createOrder` (a validação lança e daria rollback na mudança). Só age no primeiro toque do NFT desde
 * o seed (`versions` vazio): assim a mudança é única e refazer a cotação depois dela funciona.
 */
export function applyQuoteDrift(
  db: MockDb,
  touch: Touch,
  input: { accountId: Id; idempotencyKey: string; body: CreateOrderRequest; rules?: ScenarioRules },
): void {
  const { accountId, idempotencyKey, body, rules } = input
  if (!rules?.priceChangeAfterQuote && !rules?.soldOutAfterQuote) return
  if (db.idempotency[idempotencyId(accountId, idempotencyKey)]) return
  const quote = db.quotes[body.quoteId]
  if (quote?.accountId !== accountId) return

  for (const item of quote.items) {
    const nft = db.nfts[item.nftId]
    if (!nft || `nft:${nft.id}` in db.versions) continue
    if (rules.priceChangeAfterQuote) {
      nft.price = addEth(nft.price, parseEth('0.01'))
      touch('nft', nft.id)
    } else {
      const edition = nft.editions.find((e) => e.kind === item.edition)
      if (edition && edition.available > 0) {
        edition.available = 0
        touch('nft', nft.id)
      }
    }
  }
}

/** Revalida o snapshot da cotação contra o estado atual; qualquer divergência vira 409 com motivo por item. */
function revalidate(db: MockDb, quote: StoredQuote, now: Date): void {
  if (Date.parse(quote.expiresAt) <= now.getTime()) {
    throw conflict('A cotação expirou. Gere uma nova cotação.')
  }
  // Estoque não é reservado no `pending`: desconta o que já está prometido a pedidos em andamento
  const reserved = new Map<string, number>()
  for (const order of Object.values(db.orders)) {
    if (order.status !== 'pending') continue
    for (const item of order.items) {
      const key = `${item.nftId}:${item.edition}`
      reserved.set(key, (reserved.get(key) ?? 0) + item.quantity)
    }
  }
  const fieldErrors: Record<string, string> = {}
  for (const item of quote.items) {
    const nft = db.nfts[item.nftId]
    const edition = nft?.editions.find((e) => e.kind === item.edition)
    const key = `${item.nftId}:${item.edition}`
    if (!nft || !edition) fieldErrors[key] = 'Item indisponível.'
    else if (nft.price !== item.unitPrice) fieldErrors[key] = `Preço alterado de ${item.unitPrice} para ${nft.price} ETH.`
    else {
      const free = Math.max(0, edition.available - (reserved.get(key) ?? 0))
      if (free < item.quantity) fieldErrors[key] = `Estoque insuficiente (restam ${free}).`
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw conflict('Os itens da cotação mudaram. Revise o carrinho e gere uma nova cotação.', fieldErrors)
  }
}

export function createOrder(db: MockDb, touch: Touch, input: CreateOrderInput): CreateOrderResult {
  const { accountId, idempotencyKey, body, now } = input
  const idemId = idempotencyId(accountId, idempotencyKey)
  const fingerprint = fingerprintOf(accountId, body)

  const known = db.idempotency[idemId]
  if (known) {
    if (known.fingerprint !== fingerprint) {
      throw conflict('Esta Idempotency-Key já foi usada com outro pedido.')
    }
    const existing = db.orders[known.orderId]
    if (existing) return { order: existing, created: false }
  }

  const quote = ownedQuote(db, accountId, body.quoteId)
  const found = findWallet(db, body.walletId)
  if (!found) throw missing('Carteira não encontrada.')
  if (found.ownerId !== accountId) throw forbidden('Esta carteira pertence a outra conta.')

  const used = Object.values(db.orders).find((o) => o.quoteId === quote.quoteId && o.status !== 'declined')
  if (used) throw conflict('Esta cotação já foi usada em outro pedido.')

  revalidate(db, quote, now)

  const items: OrderItem[] = quote.items.map((item) => ({
    nftId: item.nftId,
    name: db.nfts[item.nftId]?.name ?? item.nftId,
    edition: item.edition,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }))
  const at = now.toISOString()
  const order: StoredOrder = {
    id: newId(),
    accountId,
    status: 'pending',
    idempotencyKey,
    quoteId: quote.quoteId,
    walletId: found.wallet.id,
    network: found.wallet.network,
    items,
    receipt: {
      items: structuredClone(items),
      subtotal: quote.subtotal,
      discount: quote.discount,
      networkFee: quote.networkFee,
      total: quote.total,
    },
    createdAt: at,
    updatedAt: at,
  }
  db.orders[order.id] = order
  db.idempotency[idemId] = { fingerprint, orderId: order.id }
  touch('order', order.id)
  touch('idempotency', idemId)
  return { order, created: true }
}

/** Remove o `accountId` interno antes de responder. */
export function toOrder(stored: StoredOrder): Order {
  const order: Partial<StoredOrder> = { ...stored }
  delete order.accountId
  return order as Order
}
