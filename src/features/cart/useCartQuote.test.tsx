// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cartFingerprint, cartKeys } from '@/api/cart'
import type { Cart, Quote } from '@/contracts'
import { parseEth } from '@/lib/eth'
import { useCartQuote } from './useCartQuote'

const post = vi.hoisted(() => vi.fn())
vi.mock('@/api/client', () => ({ apiClient: { post } }))

const ANA = 'user-ana'
const cartOf = (quantity: number): Cart => ({ items: [{ nftId: 'nft-002', edition: '1/10', quantity }] })
const quoteOf = (quoteId: string, unitPrice = '0.5', unavailable = false): Quote => ({
  quoteId,
  items: [{ nftId: 'nft-002', edition: '1/10', quantity: 1, unitPrice: parseEth(unitPrice) }],
  subtotal: parseEth(unitPrice),
  discount: parseEth('0'),
  networkFee: parseEth('0.002'),
  total: parseEth(unitPrice),
  ...(unavailable ? { issues: [{ nftId: 'nft-002', edition: '1/10' as const, kind: 'unavailable' as const }] } : {}),
  // Perto (10 min): o `refetchInterval` fica em ~9 min; uma data distante estouraria o `setTimeout`
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
})

/** Cada `POST /quotes` fica pendente até o teste resolver ou rejeitar. */
function deferredPosts() {
  const pending: { resolve: (q: Quote) => void; reject: (e: Error) => void }[] = []
  post.mockImplementation(
    () => new Promise((resolve, reject) => pending.push({ resolve: (q) => resolve({ data: q }), reject })),
  )
  return pending
}

function setup(initial: Cart) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const hook = renderHook(({ cart }: { cart: Cart }) => useCartQuote(ANA, cart), { wrapper, initialProps: { cart: initial } })
  return { queryClient, ...hook }
}

afterEach(() => {
  cleanup()
  post.mockReset()
})

describe('useCartQuote', () => {
  it('cotação atual: libera o checkout e expõe o unitPrice da linha', async () => {
    const posts = deferredPosts()
    const { result } = setup(cartOf(1))
    expect(result.current.quote).toBeUndefined()
    expect(result.current.canCheckout).toBe(false)
    act(() => posts[0]?.resolve(quoteOf('q1')))
    await waitFor(() => expect(result.current.quote?.quoteId).toBe('q1'))
    expect(result.current.recalculating).toBe(false)
    expect(result.current.canCheckout).toBe(true)
    expect(result.current.unitPriceOf({ nftId: 'nft-002', edition: '1/10' })).toEqual(parseEth('0.5'))
    expect(result.current.unitPriceOf({ nftId: 'nft-002', edition: 'open' })).toBeUndefined()
  })

  it('recotando por chave nova: a anterior fica na tela, recalculando e sem checkout', async () => {
    const posts = deferredPosts()
    const { result, rerender } = setup(cartOf(1))
    act(() => posts[0]?.resolve(quoteOf('q1')))
    await waitFor(() => expect(result.current.quote?.quoteId).toBe('q1'))

    rerender({ cart: cartOf(2) })
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(result.current.quote?.quoteId).toBe('q1')
    expect(result.current.isPlaceholderData).toBe(true)
    expect(result.current.recalculating).toBe(true)
    expect(result.current.canCheckout).toBe(false)

    act(() => posts[1]?.resolve(quoteOf('q2')))
    await waitFor(() => expect(result.current.quote?.quoteId).toBe('q2'))
    expect(result.current.recalculating).toBe(false)
    expect(result.current.canCheckout).toBe(true)
  })

  it('recotando por invalidação da mesma chave (nft.updated): recalculando até a resposta nova', async () => {
    const posts = deferredPosts()
    const { result, queryClient } = setup(cartOf(1))
    act(() => posts[0]?.resolve(quoteOf('q1')))
    await waitFor(() => expect(result.current.quote?.quoteId).toBe('q1'))

    act(() => void queryClient.invalidateQueries({ queryKey: cartKeys.quote(ANA, cartFingerprint(cartOf(1))) }))
    await waitFor(() => expect(result.current.recalculating).toBe(true))
    expect(result.current.isPlaceholderData).toBe(false)
    expect(result.current.quote?.quoteId).toBe('q1')
    expect(result.current.canCheckout).toBe(false)

    act(() => posts[1]?.resolve(quoteOf('q2', '0.6')))
    await waitFor(() => expect(result.current.recalculating).toBe(false))
    expect(result.current.quote?.quoteId).toBe('q2')
    expect(result.current.canCheckout).toBe(true)
  })

  it('erro com dado antigo: staleAfterError, a cotação antiga fica e o checkout trava; sem dado é só erro', async () => {
    const posts = deferredPosts()
    const { result } = setup(cartOf(1))
    act(() => posts[0]?.resolve(quoteOf('q1')))
    await waitFor(() => expect(result.current.quote?.quoteId).toBe('q1'))

    act(() => void result.current.refetch())
    await waitFor(() => expect(posts).toHaveLength(2))
    act(() => posts[1]?.reject(new Error('503')))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.staleAfterError).toBe(true)
    expect(result.current.quote?.quoteId).toBe('q1')
    expect(result.current.canCheckout).toBe(false)

    const fresh = setup(cartOf(3))
    await waitFor(() => expect(posts).toHaveLength(3))
    act(() => posts[2]?.reject(new Error('503')))
    await waitFor(() => expect(fresh.result.current.isError).toBe(true))
    expect(fresh.result.current.staleAfterError).toBe(false)
    expect(fresh.result.current.quote).toBeUndefined()
  })

  it('issues bloqueiam o checkout e saem por linha', async () => {
    const posts = deferredPosts()
    const { result } = setup(cartOf(1))
    act(() => posts[0]?.resolve(quoteOf('q1', '0.5', true)))
    await waitFor(() => expect(result.current.quote?.quoteId).toBe('q1'))
    expect(result.current.hasIssues).toBe(true)
    expect(result.current.issues.get('nft-002:1/10')).toBe('unavailable')
    expect(result.current.canCheckout).toBe(false)
  })

  it('sem conta (visitante) não cota', () => {
    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useCartQuote(undefined, cartOf(1)), { wrapper })
    expect(post).not.toHaveBeenCalled()
    expect(result.current.quote).toBeUndefined()
    expect(result.current.canCheckout).toBe(false)
  })
})
