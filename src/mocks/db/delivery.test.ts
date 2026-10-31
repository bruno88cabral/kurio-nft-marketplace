import { describe, expect, it, vi } from 'vitest'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/contracts'
import { parseEth } from '@/lib/eth'
import { createBus, type BusEvent } from './bus'
import { shouldDeliver } from './delivery'
import type { MockDb } from './schema'

const meta = { eventId: 'e1', version: 1, occurredAt: '2026-01-01T00:00:00.000Z' }
const nftEvent: BusEvent = {
  name: 'nft.updated',
  event: {
    ...meta,
    resource: { type: 'nft', id: 'nft-001' },
    payload: { id: 'nft-001', price: parseEth('1'), editions: [] },
  } satisfies NftUpdatedEvent,
}
const orderEvent: BusEvent = {
  name: 'order.updated',
  event: {
    ...meta,
    resource: { type: 'order', id: 'o1' },
    payload: { id: 'o1', status: 'confirmed' },
  } satisfies OrderUpdatedEvent,
}
const orders = { o1: { accountId: 'user-ana' } } as unknown as MockDb['orders']

describe('shouldDeliver', () => {
  it('anônimo recebe nft.updated e não order.updated', () => {
    expect(shouldDeliver(nftEvent, null, orders)).toBe(true)
    expect(shouldDeliver(orderEvent, null, orders)).toBe(false)
  })
  it('o dono recebe order.updated', () => {
    expect(shouldDeliver(orderEvent, 'user-ana', orders)).toBe(true)
  })
  it('outra conta não recebe order.updated, mas recebe nft.updated', () => {
    expect(shouldDeliver(orderEvent, 'user-bruno', orders)).toBe(false)
    expect(shouldDeliver(nftEvent, 'user-bruno', orders)).toBe(true)
  })
  it('pedido inexistente não é entregue; reset nunca sai pelo socket', () => {
    expect(shouldDeliver(orderEvent, 'user-ana', {})).toBe(false)
    expect(shouldDeliver({ name: 'reset' }, 'user-ana', orders)).toBe(false)
  })
})

describe('bus', () => {
  it('um listener que lança não impede os outros nem quem publica', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const bus = createBus()
    const received: BusEvent[] = []
    bus.subscribe(() => {
      throw new Error('cliente fechado')
    })
    bus.subscribe((e) => received.push(e))
    expect(() => bus.publish(nftEvent)).not.toThrow()
    expect(received).toEqual([nftEvent])
    error.mockRestore()
  })
  it('last() guarda o último nft/order e ignora reset', () => {
    const bus = createBus()
    expect(bus.last()).toBeUndefined()
    bus.publish(nftEvent)
    bus.publish(orderEvent)
    bus.publish({ name: 'reset' })
    expect(bus.last()).toBe(orderEvent)
  })
})
