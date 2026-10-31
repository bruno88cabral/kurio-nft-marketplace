// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { CartItem } from '@/contracts'
import { ANONYMOUS_CART_KEY, createAnonymousCartStore } from './anonymousCart'

afterEach(cleanup)

const line = (quantity: number): CartItem => ({ nftId: 'nft-002', edition: '1/10', quantity })

/** O `localStorage` compartilhado entre abas: a outra aba grava direto nele e o browser dispara `storage` aqui. */
function sharedStorage() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

function otherTabWrites(storage: ReturnType<typeof sharedStorage>, key: string | null, value: string | null) {
  if (key === null) storage.map.clear()
  else if (value === null) storage.map.delete(key)
  else storage.map.set(key, value)
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }))
}

describe('anonymousCart: evento storage de outra aba', () => {
  it('atualiza o snapshot de quem assina (useSyncExternalStore) quando outra aba grava kurio:cart', () => {
    const storage = sharedStorage()
    const store = createAnonymousCartStore(() => storage)
    store.add(line(1), 5)
    const { result } = renderHook(() => useSyncExternalStore(store.subscribe, store.getSnapshot))
    expect(result.current).toEqual([line(1)])

    act(() => otherTabWrites(storage, ANONYMOUS_CART_KEY, JSON.stringify([line(4)])))
    expect(result.current).toEqual([line(4)])

    // Outra aba limpou o storage inteiro (`key === null`)
    act(() => otherTabWrites(storage, null, null))
    expect(result.current).toEqual([])
  })

  it('evento de outra chave não troca o snapshot', () => {
    const storage = sharedStorage()
    const store = createAnonymousCartStore(() => storage)
    store.add(line(1), 5)
    const { result } = renderHook(() => useSyncExternalStore(store.subscribe, store.getSnapshot))
    const before = result.current
    act(() => otherTabWrites(storage, 'kurio:session', '{}'))
    expect(result.current).toBe(before)
  })

  it('depois de cancelar a assinatura, o evento não chega mais', () => {
    const storage = sharedStorage()
    const store = createAnonymousCartStore(() => storage)
    let calls = 0
    const unsubscribe = store.subscribe(() => calls++)
    otherTabWrites(storage, ANONYMOUS_CART_KEY, JSON.stringify([line(2)]))
    expect(calls).toBe(1)
    unsubscribe()
    otherTabWrites(storage, ANONYMOUS_CART_KEY, JSON.stringify([line(3)]))
    expect(calls).toBe(1)
  })
})
