import { describe, expect, it } from 'vitest'
import { getScenario } from '../scenarios'
import { addItem, applyCoupon, mergeCart, removeCoupon, removeItem, updateItem } from './cart'
import { DomainError } from './domainError'
import { createStore } from './store'

const ANA = 'user-ana'

function setup() {
  const storage = new Map<string, string>()
  return createStore({
    storage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => void storage.set(k, v),
      removeItem: (k) => void storage.delete(k),
    },
    scenario: getScenario('default'),
  })
}

describe('cart', () => {
  it('soma ao mesmo item e persiste', () => {
    const store = setup()
    store.mutate((db, touch) => addItem(db, touch, ANA, { nftId: 'nft-002', edition: '1/10', quantity: 2 }))
    store.mutate((db, touch) => addItem(db, touch, ANA, { nftId: 'nft-002', edition: '1/10', quantity: 1 }))
    expect(store.getDb().carts[ANA].items).toEqual([{ nftId: 'nft-002', edition: '1/10', quantity: 3 }])
  })

  it('acima do estoque é conflict (409) e faz rollback', () => {
    const store = setup()
    expect.assertions(4)
    try {
      store.mutate((db, touch) => addItem(db, touch, ANA, { nftId: 'nft-002', edition: '1/10', quantity: 7 }))
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError)
      expect((e as DomainError).status).toBe(409)
      expect((e as DomainError).code).toBe('conflict')
    }
    expect(store.getDb().carts[ANA].items).toEqual([])
  })

  it('recusa quantidade inválida, NFT e edição inexistentes', () => {
    const store = setup()
    const add = (nftId: string, edition: '1/1' | '1/10' | 'open', quantity: number) => () =>
      store.mutate((db, touch) => addItem(db, touch, ANA, { nftId, edition, quantity }))
    expect(add('nft-002', '1/10', 0)).toThrow(DomainError)
    expect(add('nft-002', '1/10', 1.5)).toThrow(DomainError)
    expect(add('nft-999', '1/10', 1)).toThrow(DomainError)
    expect(add('nft-002', '1/1', 1)).toThrow(DomainError)
  })

  it('update define a quantidade, limitada ao estoque; remove é idempotente', () => {
    const store = setup()
    store.mutate((db, touch) => addItem(db, touch, ANA, { nftId: 'nft-002', edition: 'open', quantity: 1 }))
    store.mutate((db, touch) => updateItem(db, touch, ANA, 'nft-002', 'open', { quantity: 5 }))
    expect(store.getDb().carts[ANA].items[0].quantity).toBe(5)
    expect(() =>
      store.mutate((db, touch) => updateItem(db, touch, ANA, 'nft-002', 'open', { quantity: 10_000 })),
    ).toThrow(DomainError)
    expect(() =>
      store.mutate((db, touch) => updateItem(db, touch, ANA, 'nft-005', 'open', { quantity: 1 })),
    ).toThrow(DomainError)
    store.mutate((db, touch) => removeItem(db, touch, ANA, 'nft-002', 'open'))
    store.mutate((db, touch) => removeItem(db, touch, ANA, 'nft-002', 'open'))
    expect(store.getDb().carts[ANA].items).toEqual([])
  })

  it('merge soma limitado ao available e descarta o que não existe ou está esgotado', () => {
    const store = setup()
    store.mutate((db, touch) => addItem(db, touch, ANA, { nftId: 'nft-002', edition: '1/10', quantity: 4 }))
    const cart = store.mutate((db, touch) =>
      mergeCart(db, touch, ANA, {
        items: [
          { nftId: 'nft-002', edition: '1/10', quantity: 5 }, // 4 + 5 > 6 -> 6
          { nftId: 'nft-005', edition: 'open', quantity: 2 },
          { nftId: 'nft-004', edition: '1/10', quantity: 1 }, // esgotado
          { nftId: 'nft-999', edition: 'open', quantity: 1 },
          { nftId: 'nft-005', edition: 'open', quantity: 0 },
        ],
      }),
    )
    expect(cart.items).toEqual([
      { nftId: 'nft-002', edition: '1/10', quantity: 6 },
      { nftId: 'nft-005', edition: 'open', quantity: 2 },
    ])
  })

  it('cupom é normalizado, aplicado e removido', () => {
    const store = setup()
    expect(store.mutate((db, touch) => applyCoupon(db, touch, ANA, ' kurio10 ')).couponCode).toBe('KURIO10')
    expect(store.mutate((db, touch) => removeCoupon(db, touch, ANA)).couponCode).toBeUndefined()
    expect(() => store.mutate((db, touch) => applyCoupon(db, touch, ANA, '  '))).toThrow(DomainError)
  })
})
