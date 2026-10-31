import { describe, expect, it, vi } from 'vitest'
import { createKurioMock } from './devtools'
import type { BusEvent } from './db/bus'
import { createStore } from './db/store'
import { getScenario } from './scenarios'

function setup() {
  const map = new Map<string, string>()
  const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) }
  const store = createStore({ storage, scenario: getScenario('default') })
  const persistScenario = vi.fn()
  const reload = vi.fn()
  const events: BusEvent[] = []
  store.bus.subscribe((e) => events.push(e))
  return { kurio: createKurioMock({ store, scenario: 'default', persistScenario, reload }), store, persistScenario, reload, events }
}

describe('createKurioMock', () => {
  it('emit.nftUpdated passa pelo db e publica nft.updated com version maior', () => {
    const { kurio, store, events } = setup()
    kurio.emit.nftUpdated('nft-001', { price: '0.5' })
    kurio.emit.nftUpdated('nft-001', { price: '0.6' })
    expect(store.getDb().nfts['nft-001'].price).toBe('0.6')
    const versions = events.flatMap((e) => (e.name === 'nft.updated' ? [e.event.version] : []))
    expect(versions).toEqual([1, 2])
  })

  it('emit.nftUpdated rejeita NFT inexistente e preço inválido sem publicar', () => {
    const { kurio, events } = setup()
    expect(() => kurio.emit.nftUpdated('nft-999', {})).toThrow()
    expect(() => kurio.emit.nftUpdated('nft-001', { price: 'abc' })).toThrow()
    expect(events).toHaveLength(0)
  })

  it('duplicateLast repete o mesmo evento; sem evento anterior lança', () => {
    const { kurio, events } = setup()
    expect(() => kurio.duplicateLast()).toThrow()
    kurio.emit.nftUpdated('nft-001', { price: '0.5' })
    kurio.duplicateLast()
    expect(events).toHaveLength(2)
    expect(events[1]).toBe(events[0])
  })

  it('reset volta ao seed e recarrega; cenário inválido não mexe em nada', () => {
    const { kurio, store, reload, persistScenario } = setup()
    kurio.emit.nftUpdated('nft-001', { price: '0.5' })
    expect(() => kurio.reset('nope' as never)).toThrow()
    expect(reload).not.toHaveBeenCalled()
    kurio.reset('slow')
    expect(store.getDb().versions).toEqual({})
    expect(persistScenario).toHaveBeenCalledWith('slow')
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
