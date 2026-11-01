import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { cartKeys } from '@/api/cart'
import { ApiError, type Cart, type CartItem } from '@/contracts'
import {
  addItem,
  applyCoupon as applyCouponInMock,
  removeCoupon as removeCouponInMock,
  removeItem,
  updateItem,
} from '@/mocks/db/cart'
import { createStore } from '@/mocks/db/store'
import { getScenario } from '@/mocks/scenarios'
import type { SessionStorageLike } from '@/auth/sessionStorage'
import { createAnonymousCartStore } from './anonymousCart'
import { accountCartActions, createCartActions, guestCartActions, type CartApi } from './cartActions'

const ANA = 'user-ana'
const item = (quantity: number, nftId = 'nft-002', edition: CartItem['edition'] = '1/10'): CartItem => ({ nftId, edition, quantity })

function mockApi() {
  const map = new Map<string, string>()
  const store = createStore({
    storage: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) },
    scenario: getScenario('default'),
  })
  // Mesmas regras de domínio do handler do mock (estoque, 404, 409), sem a camada HTTP
  const api: CartApi = {
    addCartItem: (body) => Promise.resolve(store.mutate((db, touch) => addItem(db, touch, ANA, body))),
    updateCartItem: (nftId, edition, body) => Promise.resolve(store.mutate((db, touch) => updateItem(db, touch, ANA, nftId, edition, body))),
    removeCartItem: (nftId, edition) => Promise.resolve(store.mutate((db, touch) => removeItem(db, touch, ANA, nftId, edition))),
    applyCoupon: (body) => Promise.resolve(store.mutate((db, touch) => applyCouponInMock(db, touch, ANA, body.code))),
    removeCoupon: () => Promise.resolve(store.mutate((db) => removeCouponInMock(db, () => undefined, ANA))),
  }
  return api
}

function memory(): SessionStorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) }
}

function setup(capture: () => () => boolean = () => () => true) {
  const queryClient = new QueryClient()
  const storage = memory()
  const guestStore = createAnonymousCartStore(() => storage)
  const actions = accountCartActions({ queryClient, accountId: ANA, store: guestStore, api: mockApi(), capture })
  return { queryClient, actions, guestStore, storage }
}

describe('accountCartActions (logado)', () => {
  it('add popula [cart, id] com a resposta do mock', async () => {
    const t = setup()
    await t.actions.add(item(2), { available: 5 })
    expect(t.queryClient.getQueryData<Cart>(cartKeys.detail(ANA))).toEqual({ items: [item(2)] })
    await t.actions.add(item(1), { available: 5 })
    expect(t.queryClient.getQueryData<Cart>(cartKeys.detail(ANA))).toEqual({ items: [item(3)] })
  })

  it('setQuantity, remove e cupom também gravam o Cart devolvido', async () => {
    const t = setup()
    await t.actions.add(item(2), { available: 5 })
    await t.actions.setQuantity('nft-002', '1/10', 4)
    expect(t.queryClient.getQueryData<Cart>(cartKeys.detail(ANA))?.items).toEqual([item(4)])
    await t.actions.applyCoupon('kurio10')
    expect(t.queryClient.getQueryData<Cart>(cartKeys.detail(ANA))?.couponCode).toBe('KURIO10')
    await t.actions.removeCoupon()
    expect(t.queryClient.getQueryData<Cart>(cartKeys.detail(ANA))?.couponCode).toBeUndefined()
    await t.actions.remove('nft-002', '1/10')
    expect(t.queryClient.getQueryData<Cart>(cartKeys.detail(ANA))?.items).toEqual([])
  })

  it('sessão trocada entre a captura e o sucesso não grava', async () => {
    let same = true
    const t = setup(() => () => same)
    const pending = t.actions.add(item(1), { available: 5 })
    same = false // login, logout ou expiração antes da resposta
    await pending
    expect(t.queryClient.getQueryData(cartKeys.detail(ANA))).toBeUndefined()
    expect(t.queryClient.getQueryCache().findAll({ queryKey: cartKeys.all })).toHaveLength(0)
  })

  it('a sessão é capturada ao iniciar a ação', async () => {
    const capture = vi.fn(() => () => true)
    const t = setup(capture)
    await t.actions.add(item(1), { available: 5 })
    expect(capture).toHaveBeenCalledTimes(1)
  })

  it('erro da API (409 acima do estoque) é relançado e não grava', async () => {
    const t = setup()
    await expect(t.actions.add(item(99), { available: 5 })).rejects.toMatchObject({ code: 'conflict' })
    expect(t.queryClient.getQueryData(cartKeys.detail(ANA))).toBeUndefined()
  })

  it('o available é ignorado: quem decide o estoque é o servidor', async () => {
    const api = { ...mockApi(), addCartItem: vi.fn((b: CartItem) => Promise.resolve({ items: [b] })) }
    const queryClient = new QueryClient()
    const actions = accountCartActions({ queryClient, accountId: ANA, store: createAnonymousCartStore(() => null), api, capture: () => () => true })
    await actions.add(item(7), { available: 1 })
    expect(api.addCartItem).toHaveBeenCalledWith(item(7))
  })
})

describe('guestCartActions (visitante)', () => {
  it('add respeita o available e soma na mesma linha', async () => {
    const t = setup()
    const guest = guestCartActions(t.guestStore)
    await expect(guest.add(item(2), { available: 3 })).resolves.toBe('added')
    await expect(guest.add(item(5), { available: 3 })).resolves.toBe('partial')
    expect(t.guestStore.read()).toEqual([item(3)])
    expect(JSON.parse(t.storage.map.get('kurio:cart') ?? 'null')).toEqual([item(3)])
  })

  it('add com a linha já no available resolve unchanged e não muda nada (o logado receberia 409)', async () => {
    const t = setup()
    const guest = guestCartActions(t.guestStore)
    await guest.add(item(3), { available: 3 })
    await expect(guest.add(item(1), { available: 3 })).resolves.toBe('unchanged')
    expect(t.guestStore.read()).toEqual([item(3)])
  })

  it('setQuantity e remove são locais; cupom é no-op', async () => {
    const t = setup()
    const guest = guestCartActions(t.guestStore)
    await guest.add(item(2), { available: 9 })
    await guest.setQuantity('nft-002', '1/10', 4)
    expect(t.guestStore.read()).toEqual([item(4)])
    await guest.applyCoupon('X')
    await guest.removeCoupon()
    await guest.remove('nft-002', '1/10')
    expect(t.guestStore.read()).toEqual([])
  })
})

describe('createCartActions (escolha visitante/logado)', () => {
  it('sem accountId usa o storage local e não toca o cache', async () => {
    const t = setup()
    const actions = createCartActions({ queryClient: t.queryClient, accountId: undefined, store: t.guestStore, api: mockApi() })
    await actions.add(item(1), { available: 5 })
    expect(t.guestStore.read()).toEqual([item(1)])
    expect(t.queryClient.getQueryCache().findAll()).toHaveLength(0)
  })

  it('com accountId usa a API e não mexe no storage do visitante', async () => {
    const t = setup()
    const actions = createCartActions({ queryClient: t.queryClient, accountId: ANA, store: t.guestStore, api: mockApi(), capture: () => () => true })
    await actions.add(item(1), { available: 5 })
    expect(t.queryClient.getQueryData<Cart>(cartKeys.detail(ANA))).toEqual({ items: [item(1)] })
    expect(t.guestStore.read()).toEqual([])
  })

  it('ApiError chega a quem chamou', async () => {
    const t = setup()
    const api = { ...mockApi(), addCartItem: () => Promise.reject(new ApiError({ code: 'conflict', message: 'x' }, 409)) }
    const actions = createCartActions({ queryClient: t.queryClient, accountId: ANA, store: t.guestStore, api, capture: () => () => true })
    await expect(actions.add(item(1), { available: 1 })).rejects.toBeInstanceOf(ApiError)
  })
})
