import { describe, expect, it } from 'vitest'
import { getScenario } from '../scenarios'
import { addItem, applyCoupon } from './cart'
import { DomainError } from './domainError'
import { buildQuote, QUOTE_TTL_MS } from './quote'
import { createStore } from './store'

const ANA = 'user-ana'
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
  // nft-002: 0.35 ETH (2 un.) + nft-005: 0.15 ETH (1 un.) = 0.85
  store.mutate((db, touch) => {
    addItem(db, touch, ANA, { nftId: 'nft-002', edition: '1/10', quantity: 2 })
    addItem(db, touch, ANA, { nftId: 'nft-005', edition: 'open', quantity: 1 })
  })
  const quote = () => store.mutate((db, touch) => buildQuote(db, touch, ANA, scenario.rules, NOW))
  const coupon = (code: string) => store.mutate((db, touch) => applyCoupon(db, touch, ANA, code))
  return { store, quote, coupon }
}

describe('buildQuote', () => {
  it('sem cupom: subtotal + taxa fixa, tudo em string decimal', () => {
    const { quote, store } = setup()
    const q = quote()
    expect(q.items).toEqual([
      { nftId: 'nft-002', edition: '1/10', quantity: 2, unitPrice: '0.35' },
      { nftId: 'nft-005', edition: 'open', quantity: 1, unitPrice: '0.15' },
    ])
    expect(q.subtotal).toBe('0.85')
    expect(q.discount).toBe('0')
    expect(q.networkFee).toBe('0.002')
    expect(q.total).toBe('0.852')
    expect(q.coupon).toBeUndefined()
    expect(q.issues).toBeUndefined()
    expect(q.expiresAt).toBe(new Date(NOW.getTime() + QUOTE_TTL_MS).toISOString())
    expect(store.getDb().quotes[q.quoteId]).toMatchObject({ accountId: ANA, total: '0.852' })
  })

  it('KURIO10 aplica 10% sobre o subtotal', () => {
    const { quote, coupon } = setup()
    coupon('kurio10')
    const q = quote()
    expect(q.coupon).toEqual({ code: 'KURIO10', status: 'applied' })
    expect(q.discount).toBe('0.085')
    expect(q.total).toBe('0.767') // 0.85 - 0.085 + 0.002
  })

  it('EXPIRED5 é expired e não desconta', () => {
    const { quote, coupon } = setup()
    coupon('EXPIRED5')
    const q = quote()
    expect(q.coupon).toEqual({ code: 'EXPIRED5', status: 'expired' })
    expect(q.discount).toBe('0')
    expect(q.total).toBe('0.852')
  })

  it('código desconhecido é invalid', () => {
    const { quote, coupon } = setup()
    coupon('NOPE')
    const q = quote()
    expect(q.coupon).toEqual({ code: 'NOPE', status: 'invalid' })
    expect(q.total).toBe('0.852')
  })

  it('coupon-invalid e coupon-expired forçam o status, até para KURIO10', () => {
    for (const [name, status] of [
      ['coupon-invalid', 'invalid'],
      ['coupon-expired', 'expired'],
    ] as const) {
      const { quote, coupon } = setup(name)
      coupon('KURIO10')
      const q = quote()
      expect(q.coupon).toEqual({ code: 'KURIO10', status })
      expect(q.discount).toBe('0')
    }
  })

  it('carrinho vazio é erro de validação', () => {
    const storage = new Map<string, string>()
    const scenario = getScenario('default')
    const store = createStore({
      storage: {
        getItem: (k) => storage.get(k) ?? null,
        setItem: (k, v) => void storage.set(k, v),
        removeItem: (k) => void storage.delete(k),
      },
      scenario,
    })
    expect(() => store.mutate((db, touch) => buildQuote(db, touch, ANA, scenario.rules, NOW))).toThrow(DomainError)
  })

  it('estoque que já não cobre o carrinho vira issue unavailable', () => {
    const { store, quote } = setup()
    store.mutate((db, touch) => {
      db.nfts['nft-005'].editions[0].available = 0
      touch('nft', 'nft-005')
    })
    expect(quote().issues).toEqual([{ nftId: 'nft-005', edition: 'open', kind: 'unavailable' }])
  })
})
