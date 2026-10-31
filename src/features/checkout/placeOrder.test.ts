import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { orderKeys } from '@/api/orders'
import { ApiError, type CreateOrderRequest, type Order } from '@/contracts'
import { addEth, parseEth } from '@/lib/eth'
import { addItem } from '@/mocks/db/cart'
import { DomainError } from '@/mocks/db/domainError'
import { applyQuoteDrift, createOrder as createOrderInMock, toOrder } from '@/mocks/db/orders'
import { buildQuote } from '@/mocks/db/quote'
import { createStore } from '@/mocks/db/store'
import { getScenario } from '@/mocks/scenarios'
import { createDraftStore, pendingAttempt } from './checkoutDraft'
import { classifyOrderError, confirmPurchase, resendPendingOrder, type PlaceOrderDeps } from './placeOrder'
import { snapshotOf } from './reviewSnapshot'

const ANA = 'user-ana'
const WALLET = 'wallet-ana-1'

const toApiError = (e: unknown) =>
  e instanceof DomainError ? new ApiError({ code: e.code, message: e.message, fieldErrors: e.fieldErrors }, e.status) : e

/** O mock (mesmas regras do handler: drift do cenário, idempotência, revalidação) sem a camada HTTP. */
function setup(scenarioName = 'default') {
  const map = new Map<string, string>()
  const scenario = getScenario(scenarioName)
  const store = createStore({
    storage: { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) },
    scenario,
  })
  store.mutate((db, touch) => {
    addItem(db, touch, ANA, { nftId: 'nft-002', edition: '1/10', quantity: 1 })
  })
  const requote = vi.fn(() => Promise.resolve(store.mutate((db, touch) => buildQuote(db, touch, ANA, scenario.rules, new Date()))))
  const calls: { body: CreateOrderRequest; key: string }[] = []
  // `failNext`: o servidor cria, mas a resposta não chega (o `order-timeout`)
  let failNext = false
  const createOrder = vi.fn(async (body: CreateOrderRequest, key: string): Promise<Order> => {
    calls.push({ body, key })
    await Promise.resolve()
    try {
      if (scenario.rules?.priceChangeAfterQuote || scenario.rules?.soldOutAfterQuote) {
        store.mutate((db, touch) => applyQuoteDrift(db, touch, { accountId: ANA, idempotencyKey: key, body, rules: scenario.rules }))
      }
      const { order } = store.mutate((db, touch) =>
        createOrderInMock(db, touch, { accountId: ANA, idempotencyKey: key, body, now: new Date() }),
      )
      if (failNext) {
        failNext = false
        throw new ApiError({ code: 'transient', message: 'timeout of 10000ms exceeded' })
      }
      return toOrder(order)
    } catch (e) {
      throw toApiError(e)
    }
  })
  const queryClient = new QueryClient()
  const drafts = createDraftStore(ANA, null)
  let n = 0
  const deps: PlaceOrderDeps = { queryClient, accountId: ANA, drafts, createOrder, newKey: () => `key-${++n}` }
  const orders = () => Object.values(store.getDb().orders)
  return { store, requote, createOrder, calls, deps, drafts, queryClient, orders, failOnce: () => (failNext = true) }
}

describe('confirmPurchase', () => {
  it('sem diferença: grava a chave antes do POST, cria o pedido e o põe no cache', async () => {
    const t = setup()
    const reviewed = snapshotOf(await t.requote())
    const outcome = await confirmPurchase(t.deps, { reviewed, walletId: WALLET, requote: t.requote })
    expect(outcome.kind).toBe('created')
    if (outcome.kind !== 'created') return
    expect(t.calls).toHaveLength(1)
    expect(t.drafts.get().idempotencyKey).toBe(t.calls[0]?.key)
    expect(t.queryClient.getQueryData(orderKeys.detail(ANA, outcome.order.id))).toEqual(outcome.order)
  })

  it('revalidação com diferença não envia e devolve o snapshot novo', async () => {
    const t = setup()
    const reviewed = snapshotOf(await t.requote())
    // O preço muda entre revisar e confirmar (R3)
    t.store.mutate((db, touch) => {
      const nft = db.nfts['nft-002']
      nft.price = addEth(nft.price, parseEth('0.01'))
      touch('nft', nft.id)
    })
    const outcome = await confirmPurchase(t.deps, { reviewed, walletId: WALLET, requote: t.requote })
    expect(outcome.kind).toBe('changed')
    expect(t.createOrder).not.toHaveBeenCalled()
    expect(t.drafts.get().idempotencyKey).toBeUndefined()
    if (outcome.kind !== 'changed') return
    expect(outcome.changes.map((c) => c.kind)).toEqual(['unitPrice', 'total'])

    // Novo clique, já com o novo revisado: envia
    const again = await confirmPurchase(t.deps, { reviewed: outcome.snapshot, walletId: WALLET, requote: t.requote })
    expect(again.kind).toBe('created')
    expect(t.orders()).toHaveLength(1)
  })

  it('cotação com issues bloqueia sem enviar', async () => {
    const t = setup()
    const reviewed = snapshotOf(await t.requote())
    t.store.mutate((db, touch) => {
      db.nfts['nft-002'].editions.find((e) => e.kind === '1/10')!.available = 0
      touch('nft', 'nft-002')
    })
    const outcome = await confirmPurchase(t.deps, { reviewed, walletId: WALLET, requote: t.requote })
    // A disponibilidade mudou: primeiro avisa a diferença; com o novo revisado, bloqueia
    expect(outcome.kind).toBe('changed')
    if (outcome.kind !== 'changed') return
    const blocked = await confirmPurchase(t.deps, { reviewed: outcome.snapshot, walletId: WALLET, requote: t.requote })
    expect(blocked.kind).toBe('blocked')
    expect(t.createOrder).not.toHaveBeenCalled()
  })

  it('transient (order-timeout) reenvia a mesma chave e o mesmo corpo: um único pedido', async () => {
    const t = setup()
    const reviewed = snapshotOf(await t.requote())
    t.failOnce()
    const outcome = await confirmPurchase(t.deps, { reviewed, walletId: WALLET, requote: t.requote })
    expect(outcome.kind).toBe('transient')
    expect(t.orders()).toHaveLength(1) // o servidor criou; a resposta é que não chegou
    expect(pendingAttempt(t.drafts.get())).toEqual({ key: 'key-1', body: t.calls[0]?.body })

    const retry = await resendPendingOrder(t.deps)
    expect(retry?.kind).toBe('created')
    expect(t.calls.map((c) => c.key)).toEqual(['key-1', 'key-1'])
    expect(t.calls[1]?.body).toEqual(t.calls[0]?.body)
    expect(t.orders()).toHaveLength(1)
    if (retry?.kind === 'created') expect(retry.order.id).toBe(t.orders()[0]?.id)
  })

  it('com uma tentativa pendente, "Confirmar" também só reenvia (não recota nem gera outra chave)', async () => {
    const t = setup()
    const reviewed = snapshotOf(await t.requote())
    t.failOnce()
    await confirmPurchase(t.deps, { reviewed, walletId: WALLET, requote: t.requote })
    t.requote.mockClear()
    const again = await confirmPurchase(t.deps, { reviewed, walletId: WALLET, requote: t.requote })
    expect(again.kind).toBe('created')
    expect(t.requote).not.toHaveBeenCalled()
    expect(t.calls.map((c) => c.key)).toEqual(['key-1', 'key-1'])
    expect(t.orders()).toHaveLength(1)
  })

  it('refresh com a chave gravada: outro store lê o rascunho e reenviar devolve o mesmo pedido', async () => {
    const t = setup()
    const map = new Map<string, string>()
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) }
    const before = createDraftStore(ANA, storage)
    const reviewed = snapshotOf(await t.requote())
    t.failOnce()
    await confirmPurchase({ ...t.deps, drafts: before }, { reviewed, walletId: WALLET, requote: t.requote })

    const afterRefresh = createDraftStore(ANA, storage)
    const retry = await resendPendingOrder({ ...t.deps, drafts: afterRefresh })
    expect(retry?.kind).toBe('created')
    expect(t.orders()).toHaveLength(1)
  })

  it('409 por item (price-changed) volta à revisão com a mensagem da linha e descarta a chave', async () => {
    const t = setup('price-changed')
    const reviewed = snapshotOf(await t.requote())
    const outcome = await confirmPurchase(t.deps, { reviewed, walletId: WALLET, requote: t.requote })
    expect(outcome.kind).toBe('items')
    if (outcome.kind !== 'items') return
    expect(outcome.fieldErrors['nft-002:1/10']).toMatch(/^Preço alterado de .+ para .+ ETH\.$/)
    expect(t.drafts.get().idempotencyKey).toBeUndefined()
    expect(t.orders()).toHaveLength(0)

    // A tela recota (o novo preço vira o revisado) e a nova confirmação conclui com outra chave
    const fresh = snapshotOf(await t.requote())
    const again = await confirmPurchase(t.deps, { reviewed: fresh, walletId: WALLET, requote: t.requote })
    expect(again.kind).toBe('created')
    expect(t.calls.map((c) => c.key)).toEqual(['key-1', 'key-2'])
  })

  it('409 por item (sold-out) e a recotação seguinte bloqueia', async () => {
    const t = setup('sold-out')
    const reviewed = snapshotOf(await t.requote())
    const outcome = await confirmPurchase(t.deps, { reviewed, walletId: WALLET, requote: t.requote })
    expect(outcome.kind).toBe('items')
    if (outcome.kind === 'items') expect(outcome.fieldErrors['nft-002:1/10']).toMatch(/^Estoque insuficiente|^Item indisponível/)
    const fresh = await t.requote()
    expect(fresh.issues).toEqual([{ nftId: 'nft-002', edition: '1/10', kind: 'unavailable' }])
  })

  it('fatal (carteira inexistente) descarta a tentativa e a próxima confirmação usa chave nova', async () => {
    const t = setup()
    const reviewed = snapshotOf(await t.requote())
    // A carteira foi removida em outra aba entre conectar e confirmar
    const outcome = await confirmPurchase(t.deps, { reviewed, walletId: 'wallet-removida', requote: t.requote })
    expect(outcome.kind).toBe('fatal')
    if (outcome.kind === 'fatal') expect((outcome.error as ApiError).status).toBe(404)
    expect(pendingAttempt(t.drafts.get())).toBeUndefined()
    expect(t.orders()).toHaveLength(0)
    expect(await resendPendingOrder(t.deps)).toBeUndefined()

    const again = await confirmPurchase(t.deps, { reviewed, walletId: WALLET, requote: t.requote })
    expect(again.kind).toBe('created')
    expect(t.calls.map((c) => c.key)).toEqual(['key-1', 'key-2'])
    expect(t.orders()).toHaveLength(1)
  })

  it('troca de sessão no meio não grava o pedido no cache', async () => {
    const t = setup()
    const reviewed = snapshotOf(await t.requote())
    let same = true
    const pending = confirmPurchase({ ...t.deps, sameSession: () => same }, {
      reviewed,
      walletId: WALLET,
      requote: async () => {
        const q = await t.requote()
        return q
      },
    })
    same = false
    expect((await pending).kind).toBe('stale-session')
    expect(t.queryClient.getQueryCache().findAll({ queryKey: orderKeys.all })).toHaveLength(0)
  })
})

describe('classifyOrderError', () => {
  it('separa transient, 409 por item, 409 da cotação e o resto', () => {
    expect(classifyOrderError(new ApiError({ code: 'transient', message: 'x' }))).toBe('transient')
    expect(classifyOrderError(new Error('rede'))).toBe('transient')
    expect(classifyOrderError(new ApiError({ code: 'conflict', message: 'x', fieldErrors: { 'nft-1:open': 'Item indisponível.' } }, 409))).toBe('items')
    expect(classifyOrderError(new ApiError({ code: 'conflict', message: 'A cotação expirou.' }, 409))).toBe('quote')
    expect(classifyOrderError(new ApiError({ code: 'not_found', message: 'x' }, 404))).toBe('fatal')
  })
})
