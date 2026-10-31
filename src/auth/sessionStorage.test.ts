import { describe, expect, it } from 'vitest'
import { clearSession, readSession, SESSION_STORAGE_KEY, writeSession, type SessionStorageLike } from './sessionStorage'

function memory(): SessionStorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

const NOW = Date.parse('2026-10-31T12:00:00.000Z')
const FUTURE = '2026-11-01T12:00:00.000Z'
const PAST = '2026-10-30T12:00:00.000Z'

describe('sessionStorage', () => {
  it('usa a chave kurio:session', () => {
    expect(SESSION_STORAGE_KEY).toBe('kurio:session')
  })

  it('round-trip', () => {
    const s = memory()
    writeSession(s, { token: 't', expiresAt: FUTURE })
    expect(readSession(s, NOW)).toEqual({ token: 't', expiresAt: FUTURE })
  })

  it('ausente devolve null', () => {
    expect(readSession(memory(), NOW)).toBeNull()
  })

  it('expirada conta como ausente', () => {
    const s = memory()
    writeSession(s, { token: 't', expiresAt: PAST })
    expect(readSession(s, NOW)).toBeNull()
  })

  it('JSON inválido ou formato errado conta como ausente', () => {
    const s = memory()
    s.setItem(SESSION_STORAGE_KEY, '{nope')
    expect(readSession(s, NOW)).toBeNull()
    s.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 1 }))
    expect(readSession(s, NOW)).toBeNull()
    s.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', expiresAt: 'ontem' }))
    expect(readSession(s, NOW)).toBeNull()
  })

  it('clearSession remove', () => {
    const s = memory()
    writeSession(s, { token: 't', expiresAt: FUTURE })
    clearSession(s)
    expect(s.map.size).toBe(0)
  })

  it('storage que lança não quebra', () => {
    const boom: SessionStorageLike = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => { throw new Error('blocked') },
    }
    expect(readSession(boom, NOW)).toBeNull()
    expect(() => writeSession(boom, { token: 't', expiresAt: FUTURE })).not.toThrow()
    expect(() => clearSession(boom)).not.toThrow()
  })
})
