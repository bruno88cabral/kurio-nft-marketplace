import { describe, expect, it } from 'vitest'
import { parseEth } from '@/lib/eth'
import { getScenario } from '../scenarios'
import type { BusEvent } from './bus'
import { seed } from './seed'
import { createStore, DB_STORAGE_KEY, type MockStorage } from './store'

const scenario = getScenario('default')

function memoryStorage(initial: Record<string, string> = {}): MockStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

describe('createStore', () => {
  it('começa no seed e grava na chave versionada', () => {
    const storage = memoryStorage()
    const store = createStore({ storage, scenario })
    expect(store.getDb()).toEqual(seed(scenario))
    expect(storage.map.has('kurio:mock-db:v1')).toBe(true)
    expect(DB_STORAGE_KEY).toBe('kurio:mock-db:v1')
  })

  it('reset() volta exatamente ao seed depois de mutações', () => {
    const store = createStore({ storage: memoryStorage(), scenario })
    store.mutate((db, touch) => {
      db.nfts['nft-001'].price = parseEth('9.9')
      db.carts['user-ana'].items.push({ nftId: 'nft-001', edition: '1/1', quantity: 1 })
      touch('nft', 'nft-001')
      touch('cart', 'user-ana')
    })
    expect(store.getDb()).not.toEqual(seed(scenario))
    store.reset()
    expect(store.getDb()).toEqual(seed(scenario))
  })

  it('version é monotônica por recurso e sobrevive a recarregar do mesmo storage', () => {
    const storage = memoryStorage()
    const store = createStore({ storage, scenario })
    const bump = (id: string) =>
      store.mutate((db, touch) => {
        db.nfts[id].editions[0].available -= 1
        touch('nft', id)
        touch('nft', id) // duplicado no mesmo mutate conta uma vez
      })
    bump('nft-007')
    bump('nft-007')
    bump('nft-008')
    expect(store.getDb().versions).toEqual({ 'nft:nft-007': 2, 'nft:nft-008': 1 })

    const reloaded = createStore({ storage, scenario })
    expect(reloaded.getDb()).toEqual(store.getDb())
    reloaded.mutate((db, touch) => {
      db.nfts['nft-007'].featured = true
      touch('nft', 'nft-007')
    })
    expect(reloaded.getDb().versions['nft:nft-007']).toBe(3)
  })

  it('publica nft.updated e order.updated com a version do db; outros tipos não publicam', () => {
    const store = createStore({ storage: memoryStorage(), scenario, now: () => new Date('2026-10-30T10:00:00.000Z') })
    const events: BusEvent[] = []
    const off = store.bus.subscribe((e) => events.push(e))
    store.mutate((db, touch) => {
      db.nfts['nft-002'].price = parseEth('1.5')
      touch('nft', 'nft-002')
      touch('cart', 'user-ana')
    })
    store.mutate((db, touch) => {
      db.orders['o1'] = {
        id: 'o1', accountId: 'user-ana', status: 'pending', idempotencyKey: 'k', quoteId: 'q', walletId: 'w',
        network: 'ethereum', items: [], createdAt: 'x', updatedAt: 'x',
        receipt: { items: [], subtotal: parseEth('0'), discount: parseEth('0'), networkFee: parseEth('0'), total: parseEth('0') },
      }
      touch('order', 'o1')
    })
    off()
    store.mutate((db, touch) => {
      db.nfts['nft-002'].price = parseEth('2')
      touch('nft', 'nft-002')
    })

    expect(events).toHaveLength(2)
    const [nft, order] = events
    expect(nft).toMatchObject({
      name: 'nft.updated',
      event: { resource: { type: 'nft', id: 'nft-002' }, version: 1, occurredAt: '2026-10-30T10:00:00.000Z', payload: { id: 'nft-002', price: '1.5' } },
    })
    expect(order).toMatchObject({ name: 'order.updated', event: { resource: { type: 'order', id: 'o1' }, version: 1, payload: { id: 'o1', status: 'pending' } } })
    expect(nft?.name === 'nft.updated' && nft.event.eventId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('mutate que lança não altera o estado, nem versões, nem publica', () => {
    const store = createStore({ storage: memoryStorage(), scenario })
    const events: BusEvent[] = []
    store.bus.subscribe((e) => events.push(e))
    expect(() =>
      store.mutate((db, touch) => {
        db.nfts['nft-001'].name = 'quebrado'
        touch('nft', 'nft-001')
        throw new Error('falha')
      }),
    ).toThrow('falha')
    expect(store.getDb()).toEqual(seed(scenario))
    expect(events).toEqual([])
  })

  it('chave de schema diferente ou JSON inválido refaz o seed', () => {
    const stale = JSON.stringify({ schema: 0, catalog: 'full', db: { ...seed(scenario), nfts: {} } })
    const cases: Array<Record<string, string>> = [
      { [DB_STORAGE_KEY]: stale },
      { [DB_STORAGE_KEY]: '{não é json' },
      { [DB_STORAGE_KEY]: JSON.stringify({ schema: 1, catalog: 'full', db: { users: {} } }) },
      { 'kurio:mock-db:v0': stale },
    ]
    for (const initial of cases) {
      const store = createStore({ storage: memoryStorage(initial), scenario })
      expect(store.getDb()).toEqual(seed(scenario))
    }
  })

  it('troca de catálogo (empty ↔ default) refaz o seed; o mesmo catálogo preserva o estado', () => {
    const storage = memoryStorage()
    const full = createStore({ storage, scenario })
    full.mutate((db, touch) => {
      db.carts['user-ana'].couponCode = 'KURIO10'
      touch('cart', 'user-ana')
    })
    expect(createStore({ storage, scenario: getScenario('slow') }).getDb().carts['user-ana']?.couponCode).toBe('KURIO10')
    expect(createStore({ storage, scenario: getScenario('empty') }).getDb().nfts).toEqual({})
  })

  it('segue só em memória quando o storage falha', () => {
    const broken: MockStorage = {
      getItem: () => { throw new Error('bloqueado') },
      setItem: () => { throw new Error('cheio') },
      removeItem: () => { throw new Error('bloqueado') },
    }
    const store = createStore({ storage: broken, scenario })
    store.mutate((db, touch) => {
      db.nfts['nft-001'].featured = false
      touch('nft', 'nft-001')
    })
    expect(store.getDb().versions['nft:nft-001']).toBe(1)
  })
})
