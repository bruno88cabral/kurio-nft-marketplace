import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cartKeys } from '@/api/cart'
import { nftKeys } from '@/api/nfts'
import { orderKeys } from '@/api/orders'
import { SESSION_QUERY_KEY } from '@/auth/useSession'
import type { Nft, NftEdition, NftUpdatedEvent, Order, OrderUpdatedEvent, Paginated, Quote, Session } from '@/contracts'
import { createDraftStore, type CheckoutDraft } from '@/features/checkout/checkoutDraft'
import { parseEth } from '@/lib/eth'
import { applyNftUpdated, applyOrderUpdated, invalidateAfterReconnect, quoteDivergesFrom } from './applyEvents'

const ANA = 'user-ana'
const BRUNO = 'user-bruno'
const editions = (available: number): NftEdition[] => [{ kind: '1/10', available, total: 10 }]

const nft = (id: string, price = '1'): Nft => ({
  id,
  name: `NFT ${id}`,
  imageUrl: '/x.png',
  images: ['/x.png'],
  collection: 'C',
  description: '',
  creator: 'c',
  network: 'ethereum',
  price: parseEth(price),
  editions: editions(5),
  createdAt: '2026-10-31T12:00:00.000Z',
  featured: false,
})

let seq = 0
const nftEvent = (id: string, price: string, available = 5): NftUpdatedEvent => ({
  eventId: `e${++seq}`,
  resource: { type: 'nft', id },
  version: seq,
  occurredAt: '2026-10-31T12:00:00.000Z',
  payload: { id, price: parseEth(price), editions: editions(available) },
})
const orderEvent = (id: string, status: Order['status']): OrderUpdatedEvent => ({
  eventId: `e${++seq}`,
  resource: { type: 'order', id },
  version: seq,
  occurredAt: '2026-10-31T12:00:00.000Z',
  payload: { id, status },
})

const quote = (nftId: string, unitPrice = '1', unavailable = false): Quote => ({
  quoteId: 'q1',
  items: [{ nftId, edition: '1/10', quantity: 2, unitPrice: parseEth(unitPrice) }],
  subtotal: parseEth('2'),
  discount: parseEth('0'),
  networkFee: parseEth('0.002'),
  total: parseEth('2.002'),
  ...(unavailable ? { issues: [{ nftId, edition: '1/10' as const, kind: 'unavailable' as const }] } : {}),
  expiresAt: '2026-10-31T12:05:00.000Z',
})

const order = (id: string, status: Order['status']): Order => ({
  id,
  status,
  idempotencyKey: 'k1',
  quoteId: 'q1',
  walletId: 'w1',
  network: 'ethereum',
  items: [],
  receipt: { items: [], subtotal: parseEth('0'), discount: parseEth('0'), networkFee: parseEth('0'), total: parseEth('0') },
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
})

const session = (accountId: string): Session => ({
  token: 't',
  expiresAt: '2026-11-01T12:00:00.000Z',
  account: { id: accountId, email: 'a@kurio.test', name: 'A' },
})

function setup({ accountId }: { accountId?: string } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  if (accountId) queryClient.setQueryData(SESSION_QUERY_KEY, session(accountId))
  const invalidated = (key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated ?? false
  const keys = () => queryClient.getQueryCache().findAll().map((q) => q.queryKey)
  return { queryClient, invalidated, keys }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('applyNftUpdated', () => {
  it('troca preço e editions no detalhe e no item da lista, sem mexer nos outros nem mutar', () => {
    const { queryClient } = setup()
    const detail = nft('nft-001')
    const other = nft('nft-002')
    const listKey = nftKeys.list({ tab: 'all' })
    const otherListKey = nftKeys.list({ tab: 'new' })
    const page: Paginated<Nft> = { items: [detail, other], page: 1, pageSize: 2, total: 2 }
    const otherPage: Paginated<Nft> = { items: [other], page: 1, pageSize: 1, total: 1 }
    queryClient.setQueryData(nftKeys.detail('nft-001'), detail)
    queryClient.setQueryData(nftKeys.detail('nft-002'), other)
    queryClient.setQueryData(listKey, page)
    queryClient.setQueryData(otherListKey, otherPage)
    queryClient.setQueryData(nftKeys.featured, [other, detail])
    const otherListUpdatedAt = queryClient.getQueryState(otherListKey)?.dataUpdatedAt

    applyNftUpdated(queryClient, nftEvent('nft-001', '2.5', 3))

    const newDetail = queryClient.getQueryData<Nft>(nftKeys.detail('nft-001'))
    expect(newDetail?.price).toBe('2.5')
    expect(newDetail?.editions[0]?.available).toBe(3)
    expect(newDetail?.name).toBe('NFT nft-001')
    // Objeto novo; o anterior intacto
    expect(detail.price).toBe('1')
    expect(newDetail).not.toBe(detail)

    const newPage = queryClient.getQueryData<Paginated<Nft>>(listKey)
    expect(newPage?.items[0]?.price).toBe('2.5')
    expect(newPage?.items[1]).toBe(other)
    expect(newPage?.total).toBe(2)
    expect(page.items[0]?.price).toBe('1')

    expect(queryClient.getQueryData<Nft[]>(nftKeys.featured)?.[1]?.price).toBe('2.5')
    expect(queryClient.getQueryData<Nft[]>(nftKeys.featured)?.[0]).toBe(other)
    expect(queryClient.getQueryData(nftKeys.detail('nft-002'))).toBe(other)
    // Lista sem o NFT: nem o dado nem o `dataUpdatedAt` mudam
    expect(queryClient.getQueryData(otherListKey)).toBe(otherPage)
    expect(queryClient.getQueryState(otherListKey)?.dataUpdatedAt).toBe(otherListUpdatedAt)
  })

  it('não cria chave de detalhe, lista ou destaques que não estavam no cache, nem refaz o catálogo', () => {
    const { queryClient, keys } = setup()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    applyNftUpdated(queryClient, nftEvent('nft-009', '3'))
    expect(keys()).toEqual([])
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('facetas não mudam', () => {
    const { queryClient } = setup()
    const facets = { collections: [], networks: [], price: { min: parseEth('1'), max: parseEth('1') } }
    queryClient.setQueryData(nftKeys.facets, facets)
    applyNftUpdated(queryClient, nftEvent('nft-001', '9'))
    expect(queryClient.getQueryData(nftKeys.facets)).toBe(facets)
  })

  it('cotação invalidada só quando o NFT está no carrinho (na cotação) e diverge', () => {
    const { queryClient, invalidated } = setup({ accountId: ANA })
    const quoteKey = cartKeys.quote(ANA, 'fp1')
    queryClient.setQueryData(cartKeys.detail(ANA), { items: [{ nftId: 'nft-001', edition: '1/10', quantity: 2 }] })
    queryClient.setQueryData(quoteKey, quote('nft-001', '1'))

    // NFT fora do carrinho: nada
    applyNftUpdated(queryClient, nftEvent('nft-002', '7'))
    expect(invalidated(quoteKey)).toBe(false)

    // No carrinho, sem divergência (mesmo preço, ainda há estoque): nada
    applyNftUpdated(queryClient, nftEvent('nft-001', '1.0', 4))
    expect(invalidated(quoteKey)).toBe(false)

    // No carrinho e o preço mudou: cotação desatualizada; o carrinho em si não é invalidado
    applyNftUpdated(queryClient, nftEvent('nft-001', '1.2'))
    expect(invalidated(quoteKey)).toBe(true)
    expect(invalidated(cartKeys.detail(ANA))).toBe(false)
  })

  it('visitante (sem sessão): nenhuma cotação é tocada', () => {
    const { queryClient, invalidated } = setup()
    const quoteKey = cartKeys.quote(ANA, 'fp1')
    queryClient.setQueryData(quoteKey, quote('nft-001', '1'))
    applyNftUpdated(queryClient, nftEvent('nft-001', '5'))
    expect(invalidated(quoteKey)).toBe(false)
  })

  it('a cotação de outra conta não é tocada', () => {
    const { queryClient, invalidated } = setup({ accountId: ANA })
    const brunoQuote = cartKeys.quote(BRUNO, 'fp1')
    queryClient.setQueryData(brunoQuote, quote('nft-001', '1'))
    applyNftUpdated(queryClient, nftEvent('nft-001', '5'))
    expect(invalidated(brunoQuote)).toBe(false)
  })
})

describe('quoteDivergesFrom', () => {
  const payload = (price: string, available: number) => nftEvent('nft-001', price, available).payload

  it('preço diferente do unitPrice congelado diverge; mesmo valor numérico não', () => {
    expect(quoteDivergesFrom(quote('nft-001', '1'), payload('1.5', 5))).toBe(true)
    expect(quoteDivergesFrom(quote('nft-001', '1'), payload('1.000', 5))).toBe(false)
  })

  it('estoque que deixa de cobrir a linha diverge; estoque que volta numa linha marcada unavailable também', () => {
    expect(quoteDivergesFrom(quote('nft-001', '1'), payload('1', 1))).toBe(true)
    expect(quoteDivergesFrom(quote('nft-001', '1', true), payload('1', 5))).toBe(true)
    expect(quoteDivergesFrom(quote('nft-001', '1', true), payload('1', 1))).toBe(false)
  })

  it('NFT fora da cotação não diverge', () => {
    expect(quoteDivergesFrom(quote('nft-002', '1'), payload('9', 0))).toBe(false)
  })
})

describe('applyOrderUpdated', () => {
  it('troca o status do pedido em cache e o refaz (refetchType all: mesmo sem observer)', async () => {
    const { queryClient } = setup({ accountId: ANA })
    const key = orderKeys.detail(ANA, 'o1')
    const fetched = { ...order('o1', 'confirmed'), txHash: '0xabc' }
    const queryFn = vi.fn().mockResolvedValue(fetched)
    await queryClient.prefetchQuery({ queryKey: key, queryFn: () => Promise.resolve(order('o1', 'pending')) })
    queryClient.getQueryCache().find({ queryKey: key })?.setOptions({ queryKey: key, queryFn })

    applyOrderUpdated(queryClient, orderEvent('o1', 'confirmed'))
    // Na hora: só o status muda (o resto vem do refetch)
    expect(queryClient.getQueryData<Order>(key)?.status).toBe('confirmed')
    expect(queryClient.getQueryData<Order>(key)?.txHash).toBeUndefined()

    await vi.waitFor(() => expect(queryClient.getQueryData<Order>(key)?.txHash).toBe('0xabc'))
    expect(queryFn).toHaveBeenCalledTimes(1)
  })

  it('evento durante o primeiro fetch (sem dado): a resposta velha chega e o pedido é refeito depois', async () => {
    const { queryClient } = setup({ accountId: ANA })
    const key = orderKeys.detail(ANA, 'o1')
    let resolveFirst: (o: Order) => void = () => undefined
    const queryFn = vi
      .fn<() => Promise<Order>>()
      .mockImplementationOnce(() => new Promise<Order>((r) => (resolveFirst = r)))
      .mockResolvedValue({ ...order('o1', 'confirmed'), txHash: '0xabc' })
    // Como o `ensureQueryData` do loader num refresh da Confirmação: a query existe, sem dado, com fetch em voo
    const loader = queryClient.ensureQueryData({ queryKey: key, queryFn })

    applyOrderUpdated(queryClient, orderEvent('o1', 'confirmed'))
    // Sem dado não há o que trocar, e o fetch em voo não é cancelado (o loader não rejeita)
    expect(queryClient.getQueryData(key)).toBeUndefined()
    expect(queryFn).toHaveBeenCalledTimes(1)

    // A resposta do GET saiu antes do evento: ainda `pending`
    resolveFirst(order('o1', 'pending'))
    await expect(loader).resolves.toMatchObject({ status: 'pending' })

    await vi.waitFor(() => expect(queryClient.getQueryData<Order>(key)?.status).toBe('confirmed'))
    expect(queryClient.getQueryData<Order>(key)?.txHash).toBe('0xabc')
    expect(queryFn).toHaveBeenCalledTimes(2)
  })

  it('evento durante o primeiro fetch que falha: não refaz por conta própria', async () => {
    const { queryClient } = setup({ accountId: ANA })
    const key = orderKeys.detail(ANA, 'o1')
    let rejectFirst: (e: Error) => void = () => undefined
    const queryFn = vi.fn<() => Promise<Order>>().mockImplementationOnce(() => new Promise<Order>((_, r) => (rejectFirst = r)))
    const loader = queryClient.ensureQueryData({ queryKey: key, queryFn })

    applyOrderUpdated(queryClient, orderEvent('o1', 'confirmed'))
    rejectFirst(new Error('offline'))
    await expect(loader).rejects.toThrow('offline')
    await new Promise((r) => setTimeout(r, 0))
    expect(queryFn).toHaveBeenCalledTimes(1)
  })

  it('confirmed invalida o carrinho da conta (inclui as cotações); pending/declined não', () => {
    const { queryClient, invalidated } = setup({ accountId: ANA })
    queryClient.setQueryData(cartKeys.detail(ANA), { items: [] })
    queryClient.setQueryData(cartKeys.quote(ANA, 'fp'), quote('nft-001'))

    applyOrderUpdated(queryClient, orderEvent('o1', 'declined'))
    expect(invalidated(cartKeys.detail(ANA))).toBe(false)

    applyOrderUpdated(queryClient, orderEvent('o1', 'confirmed'))
    expect(invalidated(cartKeys.detail(ANA))).toBe(true)
    expect(invalidated(cartKeys.quote(ANA, 'fp'))).toBe(true)
  })

  it('pedido de outra conta (ou fora do cache) não cria chave', () => {
    const { queryClient, keys } = setup({ accountId: ANA })
    queryClient.setQueryData(orderKeys.detail(BRUNO, 'o-bruno'), order('o-bruno', 'pending'))

    applyOrderUpdated(queryClient, orderEvent('o-bruno', 'confirmed'))

    expect(queryClient.getQueryCache().find({ queryKey: orderKeys.detail(ANA, 'o-bruno'), exact: true })).toBeUndefined()
    // O pedido em cache de outra conta continua como estava
    expect(queryClient.getQueryData<Order>(orderKeys.detail(BRUNO, 'o-bruno'))?.status).toBe('pending')
    expect(keys().filter((k) => k[0] === 'orders')).toEqual([orderKeys.detail(BRUNO, 'o-bruno')])
  })

  it('rascunho do checkout: confirmed limpa e declined tira a tentativa, só da conta da sessão e do pedido certo', () => {
    const { queryClient } = setup({ accountId: ANA })
    const attempt = (orderId: string): CheckoutDraft => ({
      walletId: 'w1',
      connectedWalletId: 'w1',
      idempotencyKey: 'k1',
      keyFingerprint: 'q1:w1',
      attempt: { quoteId: 'q1', walletId: 'w1' },
      orderId,
    })
    const ana = createDraftStore(ANA, null)
    const bruno = createDraftStore(BRUNO, null)
    const draftsOf = (accountId: string) => (accountId === ANA ? ana : bruno)
    ana.set(attempt('o1'))
    bruno.set(attempt('o1'))

    // Outro pedido, ou o mesmo ainda pending: nada muda (sem o pedido no cache, com a Confirmação fechada)
    applyOrderUpdated(queryClient, orderEvent('o2', 'confirmed'), draftsOf)
    applyOrderUpdated(queryClient, orderEvent('o1', 'pending'), draftsOf)
    expect(ana.get()).toEqual(attempt('o1'))

    applyOrderUpdated(queryClient, orderEvent('o1', 'declined'), draftsOf)
    expect(ana.get()).toEqual({ walletId: 'w1', connectedWalletId: 'w1' })

    ana.set(attempt('o1'))
    applyOrderUpdated(queryClient, orderEvent('o1', 'confirmed'), draftsOf)
    expect(ana.get()).toEqual({})
    // O rascunho de outra conta (mesmo id de pedido) não é tocado
    expect(bruno.get()).toEqual(attempt('o1'))
  })

  it('rascunho sem orderId (timeout): o evento não o toca e o R4 segue com a mesma chave', () => {
    const { queryClient } = setup({ accountId: ANA })
    const ana = createDraftStore(ANA, null)
    const draft: CheckoutDraft = { idempotencyKey: 'k1', keyFingerprint: 'q1:w1', attempt: { quoteId: 'q1', walletId: 'w1' } }
    ana.set(draft)
    applyOrderUpdated(queryClient, orderEvent('o1', 'confirmed'), () => ana)
    expect(ana.get()).toEqual(draft)
  })

  it('sem sessão: ignorado', () => {
    const { queryClient, keys } = setup()
    queryClient.setQueryData(orderKeys.detail(ANA, 'o1'), order('o1', 'pending'))
    queryClient.setQueryData(cartKeys.detail(ANA), { items: [] })
    applyOrderUpdated(queryClient, orderEvent('o1', 'confirmed'))
    expect(queryClient.getQueryData<Order>(orderKeys.detail(ANA, 'o1'))?.status).toBe('pending')
    expect(queryClient.getQueryState(cartKeys.detail(ANA))?.isInvalidated).toBe(false)
    expect(keys()).toHaveLength(2)
  })
})

describe('invalidateAfterReconnect', () => {
  it('invalida as três raízes (nfts, cart, orders) e refaz só as ativas; o resto do cache fica', async () => {
    const { queryClient, invalidated } = setup({ accountId: ANA })
    const keys = [nftKeys.detail('nft-001'), nftKeys.list({}), cartKeys.detail(ANA), cartKeys.quote(ANA, 'fp'), orderKeys.detail(ANA, 'o1')]
    for (const key of keys) queryClient.setQueryData(key, {})
    queryClient.setQueryData(['profile', ANA], {})

    const queryFn = vi.fn().mockResolvedValue({ id: 'nft-001' })
    const observer = new QueryObserver(queryClient, { queryKey: nftKeys.detail('nft-001'), queryFn })
    const unsubscribe = observer.subscribe(() => undefined)

    await invalidateAfterReconnect(queryClient)

    for (const key of keys.slice(1)) expect(invalidated(key)).toBe(true)
    expect(invalidated(['profile', ANA])).toBe(false)
    expect(invalidated(SESSION_QUERY_KEY)).toBe(false)
    // A ativa (com observer) foi refeita
    expect(queryFn).toHaveBeenCalledTimes(1)
    unsubscribe()
  })
})
