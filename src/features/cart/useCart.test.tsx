// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cartKeys } from '@/api/cart'
import type { Cart, CartItem } from '@/contracts'
import type { UseSession } from '@/auth/useSession'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }))
const session = vi.hoisted(() => {
  const current: UseSession = { account: undefined, isAuthenticated: false, isPending: false }
  return { current }
})
vi.mock('@/api/client', () => ({ apiClient: api }))
vi.mock('@/auth/useSession', () => ({ useSession: () => session.current }))
// A guarda de sessão do ciclo de vida (o hook só compõe; a guarda tem teste próprio em cartActions.test.ts)
vi.mock('@/auth/sessionGuard', () => ({ captureSession: () => () => true }))

const { useCart } = await import('./useCart')
const { ANONYMOUS_CART_KEY } = await import('./anonymousCart')

const ANA = { id: 'user-ana', email: 'ana@kurio.test', name: 'Ana' }
const line = (quantity: number, nftId = 'nft-002'): CartItem => ({ nftId, edition: '1/10', quantity })

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const hook = renderHook(() => useCart(), { wrapper })
  return { queryClient, ...hook }
}

beforeEach(() => {
  localStorage.clear()
  session.current = { account: undefined, isAuthenticated: false, isPending: false }
})
afterEach(() => {
  cleanup()
  Object.values(api).forEach((fn) => fn.mockReset())
})

describe('useCart montado (visitante)', () => {
  it('lê o kurio:cart, soma as quantidades e não chama a API', () => {
    localStorage.setItem(ANONYMOUS_CART_KEY, JSON.stringify([line(2), line(1, 'nft-005')]))
    const { result } = setup()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.isPending).toBe(false)
    expect(result.current.items).toEqual([line(2), line(1, 'nft-005')])
    expect(result.current.totalQuantity).toBe(3)
    expect(api.get).not.toHaveBeenCalled()
  })

  it('add re-renderiza com a linha nova e resolve partial (só parte coube) ou unchanged (a linha já está no available)', async () => {
    const { result } = setup()
    await act(async () => {
      await expect(result.current.add(line(2), { available: 3 })).resolves.toBe('added')
    })
    expect(result.current.items).toEqual([line(2)])
    await act(async () => {
      await expect(result.current.add(line(5), { available: 3 })).resolves.toBe('partial')
    })
    expect(result.current.items).toEqual([line(3)])
    await act(async () => {
      await expect(result.current.add(line(1), { available: 3 })).resolves.toBe('unchanged')
    })
    expect(result.current.totalQuantity).toBe(3)
    expect(JSON.parse(localStorage.getItem(ANONYMOUS_CART_KEY) ?? 'null')).toEqual([line(3)])
  })

  it('setQuantity e remove atualizam a tela; cupom é no-op', async () => {
    localStorage.setItem(ANONYMOUS_CART_KEY, JSON.stringify([line(1)]))
    const { result } = setup()
    await act(() => result.current.setQuantity('nft-002', '1/10', 4))
    expect(result.current.items).toEqual([line(4)])
    await act(() => result.current.applyCoupon('KURIO10'))
    expect(result.current.couponCode).toBeUndefined()
    await act(() => result.current.remove('nft-002', '1/10'))
    expect(result.current.items).toEqual([])
    expect(api.put).not.toHaveBeenCalled()
  })

  it('token guardado com a sessão sendo confirmada: pendente (o carrinho local não é o da conta)', () => {
    session.current = { account: undefined, isAuthenticated: false, isPending: true }
    const { result } = setup()
    expect(result.current.isPending).toBe(true)
  })
})

describe('useCart montado (logado)', () => {
  beforeEach(() => {
    session.current = { account: ANA, isAuthenticated: true, isPending: false }
  })

  it('lê GET /cart em [cart, id] e ignora o kurio:cart', async () => {
    localStorage.setItem(ANONYMOUS_CART_KEY, JSON.stringify([line(9, 'nft-009')]))
    api.get.mockResolvedValue({ data: { items: [line(1)], couponCode: 'KURIO10' } satisfies Cart })
    const { result, queryClient } = setup()
    expect(result.current.isPending).toBe(true)
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(api.get).toHaveBeenCalledWith('/cart', expect.anything())
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.items).toEqual([line(1)])
    expect(result.current.couponCode).toBe('KURIO10')
    expect(queryClient.getQueryData(cartKeys.detail(ANA.id))).toEqual({ items: [line(1)], couponCode: 'KURIO10' })
  })

  it('add vai ao servidor e a resposta aparece na tela; o storage do visitante fica intocado', async () => {
    api.get.mockResolvedValue({ data: { items: [] } satisfies Cart })
    api.post.mockResolvedValue({ data: { items: [line(2)] } satisfies Cart })
    const { result } = setup()
    await waitFor(() => expect(result.current.isPending).toBe(false))
    await act(async () => {
      await expect(result.current.add(line(2), { available: 1 })).resolves.toBe('added')
    })
    expect(api.post).toHaveBeenCalledWith('/cart/items', line(2))
    await waitFor(() => expect(result.current.items).toEqual([line(2)]))
    expect(result.current.totalQuantity).toBe(2)
    expect(localStorage.getItem(ANONYMOUS_CART_KEY)).toBeNull()
  })

  it('erro do GET: isError e o refetch tenta de novo', async () => {
    api.get.mockRejectedValueOnce(new Error('rede'))
    const { result } = setup()
    await waitFor(() => expect(result.current.isError).toBe(true))
    api.get.mockResolvedValue({ data: { items: [line(1)] } satisfies Cart })
    await act(() => result.current.refetch())
    await waitFor(() => expect(result.current.items).toEqual([line(1)]))
    expect(result.current.isError).toBe(false)
  })
})
