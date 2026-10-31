import { describe, expect, it } from 'vitest'
import type { RealtimeEvent } from '@/contracts'
import { createReconciler, DEFAULT_MAX_SEEN_EVENTS } from './reconcile'

const ev = (eventId: string, version: number, id = 'nft-001', type = 'nft'): RealtimeEvent<string, unknown> => ({
  eventId,
  resource: { type, id },
  version,
  occurredAt: '2026-10-31T12:00:00.000Z',
  payload: {},
})

describe('createReconciler', () => {
  it('eventId repetido é descartado (entrega duplicada)', () => {
    const r = createReconciler()
    expect(r.accept(ev('e1', 1))).toBe(true)
    expect(r.accept(ev('e1', 1))).toBe(false)
  })

  it('versão menor ou igual à última aplicada do recurso é descartada; maior é aplicada', () => {
    const r = createReconciler()
    expect(r.accept(ev('e1', 2))).toBe(true)
    expect(r.accept(ev('e2', 2))).toBe(false)
    expect(r.accept(ev('e3', 1))).toBe(false)
    expect(r.accept(ev('e4', 3))).toBe(true)
  })

  it('fora de ordem: o v3 chega antes do v2, e o v2 é descartado depois', () => {
    const r = createReconciler()
    expect(r.accept(ev('e1', 1))).toBe(true)
    expect(r.accept(ev('e3', 3))).toBe(true)
    expect(r.accept(ev('e2', 2))).toBe(false)
  })

  it('a versão é por recurso: tipo e id diferentes não se atrapalham', () => {
    const r = createReconciler()
    expect(r.accept(ev('e1', 5, 'nft-001'))).toBe(true)
    expect(r.accept(ev('e2', 1, 'nft-002'))).toBe(true)
    expect(r.accept(ev('e3', 1, 'nft-001', 'order'))).toBe(true)
  })

  it('evento descartado por versão não entra no histórico de eventId', () => {
    const r = createReconciler()
    r.accept(ev('e1', 2))
    expect(r.accept(ev('velho', 1))).toBe(false)
    r.reset()
    // Se o descartado tivesse sido guardado, cairia no dedupe depois do reset
    expect(r.accept(ev('velho', 1))).toBe(true)
  })

  it('limite do Set: o eventId mais antigo é esquecido (FIFO)', () => {
    expect(DEFAULT_MAX_SEEN_EVENTS).toBe(500)
    const r = createReconciler({ maxSeen: 2 })
    r.accept(ev('a', 1, 'n1'))
    r.accept(ev('b', 1, 'n2'))
    r.accept(ev('c', 1, 'n3'))
    // 'a' saiu do Set: só a versão o barra agora (mesma versão do n1)
    expect(r.accept(ev('a', 2, 'n1'))).toBe(true)
    // 'c' continua lembrado
    expect(r.accept(ev('c', 2, 'n3'))).toBe(false)
  })

  it('reset esquece eventId e versões', () => {
    const r = createReconciler()
    r.accept(ev('e1', 7))
    r.reset()
    expect(r.accept(ev('e1', 7))).toBe(true)
    expect(r.accept(ev('e2', 1))).toBe(false)
  })
})
