import { describe, expect, it } from 'vitest'
import type { SessionStorageLike } from '@/auth/sessionStorage'
import {
  checkoutDraftKey,
  createDraftStore,
  parseCheckoutDraft,
  pendingAttempt,
  readCheckoutDraft,
  withOrderKey,
  withoutOrderKey,
  writeCheckoutDraft,
} from './checkoutDraft'

function memory(): SessionStorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) }
}

const keys = () => {
  let n = 0
  return () => `key-${++n}`
}

describe('withOrderKey', () => {
  it('reaproveita a chave com o mesmo par cotação+carteira', () => {
    const newKey = keys()
    const first = withOrderKey({}, { quoteId: 'q1', walletId: 'w1' }, newKey)
    const again = withOrderKey(first.draft, { quoteId: 'q1', walletId: 'w1' }, newKey)
    expect(first.key).toBe('key-1')
    expect(again.key).toBe('key-1')
    expect(again.draft).toMatchObject({ idempotencyKey: 'key-1', keyFingerprint: 'q1:w1', attempt: { quoteId: 'q1', walletId: 'w1' } })
  })

  it('troca a chave quando a cotação muda', () => {
    const newKey = keys()
    const first = withOrderKey({}, { quoteId: 'q1', walletId: 'w1' }, newKey)
    expect(withOrderKey(first.draft, { quoteId: 'q2', walletId: 'w1' }, newKey).key).toBe('key-2')
  })

  it('troca a chave quando a carteira muda', () => {
    const newKey = keys()
    const first = withOrderKey({}, { quoteId: 'q1', walletId: 'w1' }, newKey)
    const other = withOrderKey(first.draft, { quoteId: 'q1', walletId: 'w2' }, newKey)
    expect(other.key).toBe('key-2')
    expect(other.draft.keyFingerprint).toBe('q1:w2')
  })

  it('sem a tentativa (withoutOrderKey) a próxima chave é nova, e a carteira fica', () => {
    const newKey = keys()
    const first = withOrderKey({ walletId: 'w1', connectedWalletId: 'w1' }, { quoteId: 'q1', walletId: 'w1' }, newKey)
    const cleared = withoutOrderKey(first.draft)
    expect(cleared).toEqual({ walletId: 'w1', connectedWalletId: 'w1' })
    expect(withOrderKey(cleared, { quoteId: 'q1', walletId: 'w1' }, newKey).key).toBe('key-2')
  })

  it('usa crypto.randomUUID por padrão', () => {
    expect(withOrderKey({}, { quoteId: 'q1', walletId: 'w1' }).key).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('rascunho em sessionStorage', () => {
  it('grava em kurio:checkout:<accountId> e sobrevive a um "refresh" (nova leitura)', () => {
    const storage = memory()
    const { draft } = withOrderKey({ walletId: 'w1' }, { quoteId: 'q1', walletId: 'w1' }, () => 'k')
    writeCheckoutDraft(storage, 'user-ana', draft)
    expect(storage.map.has(checkoutDraftKey('user-ana'))).toBe(true)
    expect(checkoutDraftKey('user-ana')).toBe('kurio:checkout:user-ana')
    const reread = readCheckoutDraft(storage, 'user-ana')
    expect(pendingAttempt(reread)).toEqual({ key: 'k', body: { quoteId: 'q1', walletId: 'w1' } })
    expect(readCheckoutDraft(storage, 'user-bruno')).toEqual({})
  })

  it('JSON ilegível, forma errada ou tentativa pela metade não quebram', () => {
    expect(parseCheckoutDraft('{')).toEqual({})
    expect(parseCheckoutDraft('[1]')).toEqual({})
    expect(parseCheckoutDraft(JSON.stringify({ walletId: 3, idempotencyKey: 'k' }))).toEqual({})
    expect(parseCheckoutDraft(JSON.stringify({ walletId: 'w1', idempotencyKey: 'k', keyFingerprint: 'q:w' }))).toEqual({ walletId: 'w1' })
  })

  it('storage que lança vira rascunho em memória', () => {
    const broken: SessionStorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    const store = createDraftStore('user-ana', broken)
    store.set({ walletId: 'w1' })
    expect(store.get()).toEqual({ walletId: 'w1' })
    store.clear()
    expect(store.get()).toEqual({})
  })

  it('pendingAttempt exige chave, corpo e fingerprint coerentes', () => {
    expect(pendingAttempt({})).toBeUndefined()
    expect(
      pendingAttempt({ idempotencyKey: 'k', keyFingerprint: 'q2:w1', attempt: { quoteId: 'q1', walletId: 'w1' } }),
    ).toBeUndefined()
  })
})
