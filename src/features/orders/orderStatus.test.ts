import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { cartKeys } from '@/api/cart'
import { nftKeys } from '@/api/nfts'
import type { Order } from '@/contracts'
import { parseEth } from '@/lib/eth'
import { createDraftStore } from '@/features/checkout/checkoutDraft'
import { applyOrderOutcome, ORDER_POLL_MS, orderRefetchInterval } from './orderStatus'

const ANA = 'user-ana'
const order = (status: Order['status'], idempotencyKey = 'k1'): Order => ({
  id: 'o1',
  status,
  idempotencyKey,
  quoteId: 'q1',
  walletId: 'w1',
  network: 'ethereum',
  items: [{ nftId: 'nft-002', name: 'X', edition: '1/10', quantity: 1, unitPrice: parseEth('0.5') }],
  receipt: {
    items: [{ nftId: 'nft-002', name: 'X', edition: '1/10', quantity: 1, unitPrice: parseEth('0.5') }],
    subtotal: parseEth('0.5'),
    discount: parseEth('0'),
    networkFee: parseEth('0.002'),
    total: parseEth('0.502'),
  },
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
})

const draftWithKey = (key: string) => ({
  walletId: 'w1',
  connectedWalletId: 'w1',
  idempotencyKey: key,
  keyFingerprint: 'q1:w1',
  attempt: { quoteId: 'q1', walletId: 'w1' },
})

function setup() {
  const queryClient = new QueryClient()
  queryClient.setQueryData(cartKeys.detail(ANA), { items: [] })
  queryClient.setQueryData(nftKeys.detail('nft-002'), { id: 'nft-002' })
  queryClient.setQueryData(nftKeys.detail('nft-009'), { id: 'nft-009' })
  const drafts = createDraftStore(ANA, null)
  const invalidated = (key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated
  return { queryClient, drafts, invalidated }
}

describe('orderRefetchInterval', () => {
  it('socket fora: 3 s enquanto pending; para no estado final', () => {
    expect(ORDER_POLL_MS).toBe(3_000)
    expect(orderRefetchInterval({ status: 'pending' }, false)).toBe(3_000)
    expect(orderRefetchInterval({ status: 'confirmed' }, false)).toBe(false)
    expect(orderRefetchInterval({ status: 'declined' }, false)).toBe(false)
    expect(orderRefetchInterval(undefined, false)).toBe(false)
  })

  it('socket conectado: nunca polla (o order.updated atualiza o cache)', () => {
    expect(orderRefetchInterval({ status: 'pending' }, true)).toBe(false)
    expect(orderRefetchInterval({ status: 'confirmed' }, true)).toBe(false)
  })
})

describe('applyOrderOutcome', () => {
  it('confirmed: invalida o carrinho e o NFT comprado e limpa o rascunho desta tentativa', () => {
    const t = setup()
    t.drafts.set(draftWithKey('k1'))
    applyOrderOutcome(t.queryClient, ANA, order('confirmed'), t.drafts)
    expect(t.invalidated(cartKeys.detail(ANA))).toBe(true)
    expect(t.invalidated(nftKeys.detail('nft-002'))).toBe(true)
    expect(t.invalidated(nftKeys.detail('nft-009'))).toBe(false)
    expect(t.drafts.get()).toEqual({})
  })

  it('declined: tira só a tentativa (a próxima chave é nova) e mantém a carteira', () => {
    const t = setup()
    t.drafts.set(draftWithKey('k1'))
    applyOrderOutcome(t.queryClient, ANA, order('declined'), t.drafts)
    expect(t.drafts.get()).toEqual({ walletId: 'w1', connectedWalletId: 'w1' })
    expect(t.invalidated(cartKeys.detail(ANA))).toBe(false)
  })

  it('pedido de outra tentativa não mexe no rascunho atual; pending não faz nada', () => {
    const t = setup()
    t.drafts.set(draftWithKey('k2'))
    applyOrderOutcome(t.queryClient, ANA, order('confirmed', 'k1'), t.drafts)
    applyOrderOutcome(t.queryClient, ANA, order('declined', 'k1'), t.drafts)
    expect(t.drafts.get()).toEqual(draftWithKey('k2'))
    const u = setup()
    u.drafts.set(draftWithKey('k1'))
    applyOrderOutcome(u.queryClient, ANA, order('pending'), u.drafts)
    expect(u.drafts.get()).toEqual(draftWithKey('k1'))
    expect(u.invalidated(cartKeys.detail(ANA))).toBe(false)
  })
})
