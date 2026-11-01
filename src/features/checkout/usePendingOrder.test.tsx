// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useSyncExternalStore, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cartKeys } from '@/api/cart'
import { ApiError, type Order } from '@/contracts'
import { parseEth } from '@/lib/eth'
import { createDraftStore, type CheckoutDraft } from './checkoutDraft'
import { usePendingOrder } from './usePendingOrder'

const get = vi.hoisted(() => vi.fn())
vi.mock('@/api/client', () => ({ apiClient: { get } }))

const ANA = 'user-ana'
const attempt = (orderId?: string): CheckoutDraft => ({
  walletId: 'w1',
  connectedWalletId: 'w1',
  idempotencyKey: 'k1',
  keyFingerprint: 'q1:w1',
  attempt: { quoteId: 'q1', walletId: 'w1' },
  ...(orderId ? { orderId } : {}),
})
const order = (status: Order['status']): Order => ({
  id: 'o1',
  status,
  idempotencyKey: 'k1',
  quoteId: 'q1',
  walletId: 'w1',
  network: 'ethereum',
  items: [{ nftId: 'nft-002', name: 'X', edition: '1/10', quantity: 1, unitPrice: parseEth('0.5') }],
  receipt: { items: [], subtotal: parseEth('0'), discount: parseEth('0'), networkFee: parseEth('0'), total: parseEth('0') },
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
})

function setup(draft: CheckoutDraft) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(cartKeys.detail(ANA), { items: [] })
  const drafts = createDraftStore(ANA, null)
  drafts.set(draft)
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const { result } = renderHook(
    () => {
      const current = useSyncExternalStore(drafts.subscribe, drafts.get)
      return usePendingOrder(ANA, current, drafts)
    },
    { wrapper },
  )
  return { result, drafts, queryClient }
}

afterEach(() => {
  cleanup()
  get.mockReset()
})

describe('usePendingOrder', () => {
  it('sem tentativa: none, sem consultar pedido', () => {
    const { result } = setup({ walletId: 'w1' })
    expect(result.current).toEqual({ kind: 'none' })
    expect(get).not.toHaveBeenCalled()
  })

  it('tentativa sem orderId (timeout): unconfirmed, "Tentar de novo" com a mesma chave (R4)', () => {
    const { result, drafts } = setup(attempt())
    expect(result.current).toEqual({ kind: 'unconfirmed' })
    expect(get).not.toHaveBeenCalled()
    expect(drafts.get()).toEqual(attempt())
  })

  it('orderId com o pedido ainda pending: in-progress, rascunho e carteira travados', async () => {
    get.mockResolvedValue({ data: order('pending') })
    const { result, drafts } = setup(attempt('o1'))
    expect(result.current).toMatchObject({ kind: 'in-progress', orderId: 'o1', loadFailed: false })
    await waitFor(() => expect(get).toHaveBeenCalledWith('/orders/o1', expect.anything()))
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current).toMatchObject({ kind: 'in-progress', orderId: 'o1', loadFailed: false })
    expect(drafts.get()).toEqual(attempt('o1'))
  })

  it('orderId com o pedido confirmed: limpa o rascunho e libera o checkout', async () => {
    get.mockResolvedValue({ data: order('confirmed') })
    const { result, drafts, queryClient } = setup(attempt('o1'))
    await waitFor(() => expect(result.current).toEqual({ kind: 'none' }))
    expect(drafts.get()).toEqual({})
    expect(queryClient.getQueryState(cartKeys.detail(ANA))?.isInvalidated).toBe(true)
  })

  it('orderId com o pedido declined: tira só a tentativa (a carteira fica)', async () => {
    get.mockResolvedValue({ data: order('declined') })
    const { result, drafts } = setup(attempt('o1'))
    await waitFor(() => expect(result.current).toEqual({ kind: 'none' }))
    expect(drafts.get()).toEqual({ walletId: 'w1', connectedWalletId: 'w1' })
  })

  it('a consulta falha (404): segue in-progress com "Tentar novamente", sem descartar a tentativa (R4)', async () => {
    get.mockRejectedValue(new ApiError({ code: 'not_found', message: 'Pedido não encontrado.' }, 404))
    const { result, drafts } = setup(attempt('o1'))
    await waitFor(() => expect(result.current).toMatchObject({ kind: 'in-progress', orderId: 'o1', loadFailed: true }))
    // O pedido foi criado (o 201/200 trouxe o id): nenhuma falha de leitura libera uma chave nova
    expect(drafts.get()).toEqual(attempt('o1'))

    get.mockResolvedValue({ data: order('confirmed') })
    act(() => {
      if (result.current.kind === 'in-progress') result.current.retry()
    })
    await waitFor(() => expect(result.current).toEqual({ kind: 'none' }))
    expect(drafts.get()).toEqual({})
  })
})
