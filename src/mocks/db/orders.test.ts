import { describe, expect, it } from 'vitest'
import { getScenario } from '../scenarios'
import { addItem } from './cart'
import { DomainError } from './domainError'
import { applyQuoteDrift, createOrder } from './orders'
import { buildQuote, QUOTE_TTL_MS } from './quote'
import { createStore } from './store'

const ANA = 'user-ana'
const BRUNO = 'user-bruno'
const ANA_WALLET = 'wallet-ana-1'
const NOW = new Date('2026-10-30T12:00:00.000Z')

function setup(scenarioName = 'default') {
  const storage = new Map<string, string>()
  const scenario = getScenario(scenarioName)
  const store = createStore({
    storage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => void storage.set(k, v),
      removeItem: (k) => void storage.delete(k),
    },
    scenario,
  })
  store.mutate((db, touch) => {
    addItem(db, touch, ANA, { nftId: 'nft-002', edition: '1/10', quantity: 2 })
    addItem(db, touch, ANA, { nftId: 'nft-005', edition: 'open', quantity: 1 })
  })
  const quote = () => store.mutate((db, touch) => buildQuote(db, touch, ANA, scenario.rules, NOW))
  const order = (idempotencyKey: string, quoteId: string, walletId = ANA_WALLET, accountId = ANA, now = NOW) =>
    store.mutate((db, touch) =>
      createOrder(db, touch, { accountId, idempotencyKey, body: { quoteId, walletId }, now }),
    )
  const drift = (idempotencyKey: string, quoteId: string) =>
    store.mutate((db, touch) =>
      applyQuoteDrift(db, touch, {
        accountId: ANA,
        idempotencyKey,
        body: { quoteId, walletId: ANA_WALLET },
        rules: scenario.rules,
      }),
    )
  return { store, quote, order, drift }
}

function domainError(fn: () => unknown): DomainError {
  try {
    fn()
  } catch (e) {
    if (e instanceof DomainError) return e
    throw e
  }
  throw new Error('esperava DomainError')
}

describe('createOrder', () => {
  it('cria pending com snapshot da cotação e o recibo', () => {
    const { store, quote, order } = setup()
    const q = quote()
    const { order: created, created: isNew } = order('k1', q.quoteId)
    expect(isNew).toBe(true)
    expect(created).toMatchObject({
      status: 'pending',
      idempotencyKey: 'k1',
      quoteId: q.quoteId,
      walletId: ANA_WALLET,
      network: 'ethereum',
      accountId: ANA,
    })
    expect(created.receipt.total).toBe(q.total)
    expect(created.items.map((i) => i.name)).toEqual(['Solar Veil', 'Dawn Ribbon'])
    expect(store.getDb().versions[`order:${created.id}`]).toBe(1)
  })

  it('mesma chave e mesmo payload devolvem o mesmo pedido, sem criar outro', () => {
    const { store, quote, order } = setup()
    const q = quote()
    const first = order('k1', q.quoteId)
    const second = order('k1', q.quoteId)
    expect(second.created).toBe(false)
    expect(second.order.id).toBe(first.order.id)
    expect(Object.keys(store.getDb().orders)).toHaveLength(1)
    expect(store.getDb().versions[`order:${first.order.id}`]).toBe(1)
  })

  it('mesma chave com outra quoteId é conflict', () => {
    const { quote, order } = setup()
    const q1 = quote()
    const q2 = quote()
    order('k1', q1.quoteId)
    const error = domainError(() => order('k1', q2.quoteId))
    expect(error.status).toBe(409)
    expect(error.code).toBe('conflict')
  })

  it('a chave é escopada por conta', () => {
    const { store, quote, order } = setup()
    const q = quote()
    order('k1', q.quoteId)
    // Bruno com a mesma chave não enxerga o pedido da Ana: cai na checagem de dono da cotação
    expect(domainError(() => order('k1', q.quoteId, 'wallet-bruno-1', BRUNO)).status).toBe(403)
    expect(Object.keys(store.getDb().orders)).toHaveLength(1)
  })

  it('outra chave para a mesma cotação é conflict (cotação já usada)', () => {
    const { quote, order } = setup()
    const q = quote()
    order('k1', q.quoteId)
    expect(domainError(() => order('k2', q.quoteId)).status).toBe(409)
  })

  it('cotação ou carteira de outra conta é 403; inexistente é 404', () => {
    const { quote, order } = setup()
    const q = quote()
    expect(domainError(() => order('k1', q.quoteId, 'wallet-bruno-1')).status).toBe(403)
    expect(domainError(() => order('k1', q.quoteId, 'wallet-zzz')).status).toBe(404)
    expect(domainError(() => order('k1', 'nope')).status).toBe(404)
  })

  it('cotação expirada é conflict com motivo', () => {
    const { quote, order } = setup()
    const q = quote()
    const error = domainError(() => order('k1', q.quoteId, ANA_WALLET, ANA, new Date(NOW.getTime() + QUOTE_TTL_MS)))
    expect(error.status).toBe(409)
    expect(error.message).toMatch(/expirou/)
  })

  it('preço alterado é conflict com fieldErrors por item', () => {
    const { store, quote, order } = setup()
    const q = quote()
    store.mutate((db, touch) => {
      db.nfts['nft-002'].price = '0.4' as (typeof db.nfts)['nft-002']['price']
      touch('nft', 'nft-002')
    })
    const error = domainError(() => order('k1', q.quoteId))
    expect(error.status).toBe(409)
    expect(error.fieldErrors).toEqual({ 'nft-002:1/10': 'Preço alterado de 0.35 para 0.4 ETH.' })
    expect(Object.keys(store.getDb().orders)).toHaveLength(0)
  })

  it('estoque insuficiente é conflict com fieldErrors por item', () => {
    const { store, quote, order } = setup()
    const q = quote()
    store.mutate((db, touch) => {
      db.nfts['nft-005'].editions[0].available = 0
      touch('nft', 'nft-005')
    })
    const error = domainError(() => order('k1', q.quoteId))
    expect(error.status).toBe(409)
    expect(error.fieldErrors).toEqual({ 'nft-005:open': 'Estoque insuficiente (restam 0).' })
  })
})

describe('applyQuoteDrift', () => {
  it('price-changed altera o preço depois da cotação, uma vez, e o pedido falha por preço', () => {
    const { store, quote, order, drift } = setup('price-changed')
    const q = quote()
    drift('k1', q.quoteId)
    expect(store.getDb().nfts['nft-002'].price).toBe('0.36')
    drift('k1', q.quoteId) // não acumula
    expect(store.getDb().nfts['nft-002'].price).toBe('0.36')
    expect(domainError(() => order('k1', q.quoteId)).fieldErrors?.['nft-002:1/10']).toMatch(/Preço alterado/)

    // Depois da mudança, uma nova cotação já usa o preço novo e o pedido passa
    const q2 = quote()
    drift('k2', q2.quoteId)
    expect(order('k2', q2.quoteId).created).toBe(true)
  })

  it('sold-out esgota a edição depois da cotação', () => {
    const { store, quote, order, drift } = setup('sold-out')
    const q = quote()
    drift('k1', q.quoteId)
    expect(store.getDb().nfts['nft-002'].editions[0].available).toBe(0)
    expect(domainError(() => order('k1', q.quoteId)).fieldErrors?.['nft-002:1/10']).toMatch(/Estoque insuficiente/)
  })

  it('não age em cenário comum nem em replay de pedido existente', () => {
    const { store, quote, order, drift } = setup()
    const q = quote()
    drift('k1', q.quoteId)
    expect(store.getDb().versions['nft:nft-002']).toBeUndefined()
    order('k1', q.quoteId)
    const forced = setup('price-changed')
    const fq = forced.quote()
    forced.order('k1', fq.quoteId)
    forced.drift('k1', fq.quoteId)
    expect(forced.store.getDb().nfts['nft-002'].price).toBe('0.35')
  })
})
