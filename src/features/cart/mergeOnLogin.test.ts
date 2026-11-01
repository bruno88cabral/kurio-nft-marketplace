import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cartKeys } from '@/api/cart'
import type { AuthResponse, Cart, CartItem } from '@/contracts'
import { mergeCart as mergeInMock } from '@/mocks/db/cart'
import { createStore } from '@/mocks/db/store'
import { getScenario } from '@/mocks/scenarios'
import { MERGE_FAILED_MESSAGE, mergeAnonymousCartOnLogin, type MergeOnLoginDeps } from './mergeOnLogin'

const ANA = 'user-ana'
const auth: AuthResponse = { token: 't', expiresAt: '2099-01-01T00:00:00.000Z', account: { id: ANA, email: 'ana@kurio.test', name: 'Ana' } }

function mockStore() {
  const map = new Map<string, string>()
  return createStore({
    storage: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) },
    scenario: getScenario('default'),
  })
}

function setup(stored: CartItem[], overrides: Partial<MergeOnLoginDeps> = {}) {
  const store = mockStore()
  const queryClient = new QueryClient()
  let guest = stored
  const merge = vi.fn((body: { items: CartItem[] }): Promise<Cart> =>
    Promise.resolve(store.mutate((db, touch) => mergeInMock(db, touch, ANA, body))),
  )
  const deps: MergeOnLoginDeps = {
    queryClient,
    read: () => guest,
    clear: () => {
      guest = []
    },
    merge,
    notifyError: vi.fn(),
    sameSession: () => true,
    ...overrides,
  }
  return { deps, queryClient, merge, store, guest: () => guest }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('mergeAnonymousCartOnLogin', () => {
  it('com itens guardados: chama o merge, popula [cart, id] e limpa o storage', async () => {
    const t = setup([{ nftId: 'nft-002', edition: '1/10', quantity: 2 }])
    await mergeAnonymousCartOnLogin(auth, t.deps)
    expect(t.merge).toHaveBeenCalledWith({ items: [{ nftId: 'nft-002', edition: '1/10', quantity: 2 }] })
    expect(t.queryClient.getQueryData(cartKeys.detail(ANA))).toEqual({ items: [{ nftId: 'nft-002', edition: '1/10', quantity: 2 }] })
    expect(t.guest()).toEqual([])
    expect(t.deps.notifyError).not.toHaveBeenCalled()
  })

  it('sem itens não chama a API', async () => {
    const t = setup([])
    await mergeAnonymousCartOnLogin(auth, t.deps)
    expect(t.merge).not.toHaveBeenCalled()
    expect(t.queryClient.getQueryData(cartKeys.detail(ANA))).toBeUndefined()
  })

  it('falha: o storage fica, loga o erro, avisa por toast e não relança', async () => {
    const items: CartItem[] = [{ nftId: 'nft-002', edition: '1/10', quantity: 2 }]
    const error = new Error('503')
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const t = setup(items, { merge: vi.fn().mockRejectedValue(error) })
    await expect(mergeAnonymousCartOnLogin(auth, t.deps)).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith('[cart] merge do carrinho de visitante falhou', error)
    expect(t.guest()).toEqual(items)
    expect(t.deps.notifyError).toHaveBeenCalledWith(MERGE_FAILED_MESSAGE)
    expect(MERGE_FAILED_MESSAGE).toBe('Não foi possível juntar o carrinho de visitante.')
    expect(t.queryClient.getQueryData(cartKeys.detail(ANA))).toBeUndefined()
  })

  it('sessão trocada durante o merge: limpa o storage (já mesclado) mas não toca o cache', async () => {
    const t = setup([{ nftId: 'nft-002', edition: '1/10', quantity: 1 }], { sameSession: () => false })
    await mergeAnonymousCartOnLogin(auth, t.deps)
    expect(t.guest()).toEqual([])
    expect(t.queryClient.getQueryData(cartKeys.detail(ANA))).toBeUndefined()
  })

  it('sessão trocada e falha: sem toast para a conta errada', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const t = setup([{ nftId: 'nft-002', edition: '1/10', quantity: 1 }], {
      merge: vi.fn().mockRejectedValue(new Error('x')),
      sameSession: () => false,
    })
    await mergeAnonymousCartOnLogin(auth, t.deps)
    expect(t.deps.notifyError).not.toHaveBeenCalled()
  })

  it('um GET /cart em voo desde antes do merge e que responde depois não sobrescreve o carrinho mesclado', async () => {
    const t = setup([{ nftId: 'nft-002', edition: '1/10', quantity: 2 }])
    let respondOld: (cart: Cart) => void = () => undefined
    // O GET saiu antes do merge (latência real); o servidor o respondeu com o carrinho antigo (vazio)
    const inFlight = t.queryClient.fetchQuery({
      queryKey: cartKeys.detail(ANA),
      queryFn: () => new Promise<Cart>((resolve) => (respondOld = resolve)),
    })
    await mergeAnonymousCartOnLogin(auth, t.deps)
    respondOld({ items: [] })
    await expect(inFlight).rejects.toThrow()
    expect(t.queryClient.getQueryData(cartKeys.detail(ANA))).toEqual({ items: [{ nftId: 'nft-002', edition: '1/10', quantity: 2 }] })
  })

  it('a cotação em cache não é cancelada (só a chave do carrinho)', async () => {
    const t = setup([{ nftId: 'nft-002', edition: '1/10', quantity: 1 }])
    const quoteKey = cartKeys.quote(ANA, 'fp')
    let respondQuote: (value: string) => void = () => undefined
    const quote = t.queryClient.fetchQuery({ queryKey: quoteKey, queryFn: () => new Promise<string>((resolve) => (respondQuote = resolve)) })
    await mergeAnonymousCartOnLogin(auth, t.deps)
    respondQuote('q1')
    await expect(quote).resolves.toBe('q1')
  })
})
