import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BusEvent } from './bus'
import { addItem } from './cart'
import { DomainError } from './domainError'
import { createOrder } from './orders'
import { createOrderLifecycle } from './orderLifecycle'
import { buildQuote } from './quote'
import { getScenario } from '../scenarios'
import { createStore, type MockStorage } from './store'

const ANA = 'user-ana'
const T0 = new Date('2026-10-30T12:00:00.000Z')

function memoryStorage(): MockStorage {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

function setup(scenarioName = 'default', storage = memoryStorage()) {
  const scenario = getScenario(scenarioName)
  const store = createStore({ storage, scenario })
  const lifecycle = createOrderLifecycle({ store, scenario })
  const events: BusEvent[] = []
  store.bus.subscribe((e) => events.push(e))
  return { store, lifecycle, events, storage, scenario }
}

/** Ana com 2x nft-002 (1/10) e 1x nft-005 (open) no carrinho + 1x nft-001 sobrando fora da cotação. */
function placeOrder(ctx: ReturnType<typeof setup>) {
  const { store, scenario } = ctx
  store.mutate((db, touch) => {
    addItem(db, touch, ANA, { nftId: 'nft-002', edition: '1/10', quantity: 3 })
    addItem(db, touch, ANA, { nftId: 'nft-005', edition: 'open', quantity: 1 })
  })
  const quote = store.mutate((db, touch) => buildQuote(db, touch, ANA, scenario.rules, new Date()))
  // O carrinho muda depois da cotação: o pedido leva só 2 das 3 unidades de nft-002
  store.mutate((db, touch) => {
    quote.items[0].quantity = 2
    db.quotes[quote.quoteId].items[0].quantity = 2
    touch('quote', quote.quoteId)
  })
  const { order } = store.mutate((db, touch) =>
    createOrder(db, touch, {
      accountId: ANA,
      idempotencyKey: 'k1',
      body: { quoteId: quote.quoteId, walletId: 'wallet-ana-1' },
      now: new Date(),
    }),
  )
  return order
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('orderLifecycle', () => {
  it('pending vira confirmed após orderSettleMs: txHash, estoque, carrinho e eventos', () => {
    const ctx = setup()
    const order = placeOrder(ctx)
    ctx.lifecycle.scheduleOrder(order.id)

    vi.advanceTimersByTime(2_499)
    expect(ctx.store.getDb().orders[order.id].status).toBe('pending')
    vi.advanceTimersByTime(1)

    const done = ctx.store.getDb().orders[order.id]
    expect(done.status).toBe('confirmed')
    expect(done.txHash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(done.explorerUrl).toBe(`https://etherscan.io/tx/${done.txHash}`)
    expect(ctx.store.getDb().nfts['nft-002'].editions[0].available).toBe(4) // 6 - 2
    expect(ctx.store.getDb().nfts['nft-005'].editions[0].available).toBe(819)
    // Só o comprado sai: sobra 1 unidade de nft-002 (cotação com 2 de 3)
    expect(ctx.store.getDb().carts[ANA].items).toEqual([{ nftId: 'nft-002', edition: '1/10', quantity: 1 }])
    expect(ctx.store.getDb().versions[`order:${order.id}`]).toBe(2)

    const names = ctx.events.map((e) => e.name)
    expect(names.filter((n) => n === 'nft.updated')).toHaveLength(2)
    expect(ctx.events.at(-1)).toMatchObject({
      name: 'order.updated',
      event: { resource: { type: 'order', id: order.id }, version: 2, payload: { id: order.id, status: 'confirmed' } },
    })
  })

  it('disparar o timer duas vezes baixa o estoque uma vez; confirmed não volta a pending', () => {
    const ctx = setup()
    const order = placeOrder(ctx)
    expect(ctx.lifecycle.settleOrder(order.id)).toBe(true)
    expect(ctx.lifecycle.settleOrder(order.id)).toBe(false)
    expect(ctx.store.getDb().nfts['nft-002'].editions[0].available).toBe(4)
    expect(ctx.store.getDb().orders[order.id].status).toBe('confirmed')
    // Um schedule tardio também não faz nada
    ctx.lifecycle.scheduleOrder(order.id)
    vi.advanceTimersByTime(10_000)
    expect(ctx.store.getDb().nfts['nft-002'].editions[0].available).toBe(4)
    expect(ctx.store.getDb().versions[`order:${order.id}`]).toBe(2)
  })

  it('scheduleOrder repetido arma um timer só', () => {
    const ctx = setup()
    const order = placeOrder(ctx)
    ctx.lifecycle.scheduleOrder(order.id)
    ctx.lifecycle.scheduleOrder(order.id)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('payment-declined termina em declined sem baixar estoque nem mexer no carrinho', () => {
    const ctx = setup('payment-declined')
    const order = placeOrder(ctx)
    ctx.lifecycle.scheduleOrder(order.id)
    vi.advanceTimersByTime(2_500)

    const done = ctx.store.getDb().orders[order.id]
    expect(done.status).toBe('declined')
    expect(done.txHash).toBeUndefined()
    expect(ctx.store.getDb().nfts['nft-002'].editions[0].available).toBe(6)
    expect(ctx.store.getDb().carts[ANA].items).toHaveLength(2)
    expect(ctx.events.some((e) => e.name === 'nft.updated')).toBe(false)
    expect(ctx.lifecycle.settleOrder(order.id)).toBe(false)
  })

  it('resumePendingOrders conclui um pending carregado do storage (refresh)', () => {
    const first = setup()
    const order = placeOrder(first)
    expect(first.store.getDb().orders[order.id].status).toBe('pending')

    // "Refresh": novo store e novo lifecycle sobre o mesmo storage, sem nenhum timer armado
    vi.advanceTimersByTime(1_000)
    const second = setup('default', first.storage)
    expect(second.store.getDb().orders[order.id].status).toBe('pending')
    second.lifecycle.resumePendingOrders()

    vi.advanceTimersByTime(1_499) // 2_500 desde a criação, 1_000 já passaram
    expect(second.store.getDb().orders[order.id].status).toBe('pending')
    vi.advanceTimersByTime(1)
    expect(second.store.getDb().orders[order.id].status).toBe('confirmed')
    expect(second.store.getDb().nfts['nft-002'].editions[0].available).toBe(4)
  })

  it('resumePendingOrders conclui logo o pedido cujo prazo já passou e ignora os terminais', () => {
    const first = setup()
    const order = placeOrder(first)
    vi.advanceTimersByTime(60_000)
    const second = setup('default', first.storage)
    second.lifecycle.resumePendingOrders()
    vi.advanceTimersByTime(0)
    expect(second.store.getDb().orders[order.id].status).toBe('confirmed')

    const third = setup('default', first.storage)
    third.lifecycle.resumePendingOrders()
    expect(vi.getTimerCount()).toBe(0)
  })

  describe('último estoque', () => {
    /** Ana cota e pede `qty` unidades de nft-002 (1/10, estoque 6) com a chave dada. */
    function order(ctx: ReturnType<typeof setup>, key: string, qty: number) {
      const { store, scenario } = ctx
      store.mutate((db, touch) => {
        db.carts[ANA].items = []
        addItem(db, touch, ANA, { nftId: 'nft-002', edition: '1/10', quantity: qty })
      })
      const quote = store.mutate((db, touch) => buildQuote(db, touch, ANA, scenario.rules, new Date()))
      return store.mutate((db, touch) =>
        createOrder(db, touch, {
          accountId: ANA,
          idempotencyKey: key,
          body: { quoteId: quote.quoteId, walletId: 'wallet-ana-1' },
          now: new Date(),
        }),
      ).order
    }

    it('dois pedidos pending sobre o mesmo estoque: o segundo recebe 409 e nada é vendido a mais', () => {
      const ctx = setup()
      const a = order(ctx, 'k1', 6)
      let error: unknown
      try {
        order(ctx, 'k2', 6)
      } catch (e) {
        error = e
      }
      expect(error).toBeInstanceOf(DomainError)
      expect((error as DomainError).status).toBe(409)
      expect((error as DomainError).fieldErrors).toEqual({ 'nft-002:1/10': 'Estoque insuficiente (restam 0).' })

      ctx.lifecycle.scheduleOrder(a.id)
      vi.advanceTimersByTime(2_500)
      expect(ctx.store.getDb().orders[a.id].status).toBe('confirmed')
      expect(ctx.store.getDb().nfts['nft-002'].editions[0].available).toBe(0)
      expect(Object.keys(ctx.store.getDb().orders)).toHaveLength(1)
    })

    it('estoque parcial: o segundo pedido só vê o que sobrou depois do pending', () => {
      const ctx = setup()
      order(ctx, 'k1', 4)
      expect(() => order(ctx, 'k2', 3)).toThrow(DomainError)
      expect(order(ctx, 'k3', 2).status).toBe('pending')
    })

    it('se o estoque sumiu antes do settle, o pedido é declined e o estoque não é tocado nem fica negativo', () => {
      const ctx = setup()
      const a = order(ctx, 'k1', 6)
      ctx.store.mutate((db, touch) => {
        db.nfts['nft-002'].editions[0].available = 2 // vendido por fora (ex.: drift)
        touch('nft', 'nft-002')
      })
      expect(ctx.lifecycle.settleOrder(a.id)).toBe(true)
      expect(ctx.store.getDb().orders[a.id].status).toBe('declined')
      expect(ctx.store.getDb().nfts['nft-002'].editions[0].available).toBe(2)
    })
  })
})
