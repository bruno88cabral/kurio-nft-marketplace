import { describe, expect, it } from 'vitest'
import type { SessionStorageLike } from '@/auth/sessionStorage'
import type { Quote } from '@/contracts'
import { parseEth } from '@/lib/eth'
import { attemptSnapshotOf, parseAttemptSnapshot, type AttemptSnapshot } from './attemptSnapshot'
import {
  checkoutDraftStore,
  createDraftStore,
  dropWalletConnections,
  parseCheckoutDraft,
  pendingAttempt,
  pendingAttemptSnapshot,
  readCheckoutDraft,
  settleCheckoutDraft,
  withoutConnection,
  withOrderId,
  withOrderKey,
  withoutOrderKey,
  writeCheckoutDraft,
  type CheckoutDraft,
} from './checkoutDraft'
import { reviewSource } from './reviewSource'

const quote: Quote = {
  quoteId: 'q1',
  items: [
    { nftId: 'nft-002', edition: '1/10', quantity: 2, unitPrice: parseEth('0.5') },
    { nftId: 'nft-007', edition: 'open', quantity: 1, unitPrice: parseEth('0.12') },
  ],
  subtotal: parseEth('1.12'),
  discount: parseEth('0.112'),
  networkFee: parseEth('0.003'),
  total: parseEth('1.011'),
  coupon: { code: 'KURIO10', status: 'applied' },
  issues: [],
  expiresAt: '2026-10-31T22:00:00.000Z',
}

const snapshot: AttemptSnapshot = attemptSnapshotOf(quote)

/** Tentativa pendente (timeout) com o snapshot e a conexão da carteira. */
const pendingDraft: CheckoutDraft = {
  walletId: 'w1',
  connectedWalletId: 'w1',
  idempotencyKey: 'key-1',
  keyFingerprint: 'q1:w1',
  attempt: { quoteId: 'q1', walletId: 'w1' },
  attemptSnapshot: snapshot,
}

function memory(): SessionStorageLike & Pick<Storage, 'key' | 'length'> {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
}

describe('attemptSnapshotOf', () => {
  it('copia da cotação itens, valores e cupom, sem calcular nada (e sem issues nem validade)', () => {
    expect(snapshot).toEqual({
      quoteId: 'q1',
      items: quote.items,
      subtotal: '1.12',
      discount: '0.112',
      networkFee: '0.003',
      total: '1.011',
      coupon: { code: 'KURIO10', status: 'applied' },
    })
    expect(attemptSnapshotOf({ ...quote, coupon: undefined })).not.toHaveProperty('coupon')
  })
})

describe('parseAttemptSnapshot', () => {
  it('aceita o snapshot serializado', () => {
    expect(parseAttemptSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot)
  })

  it.each([
    ['ausente', undefined],
    ['sem itens', { ...snapshot, items: [] }],
    ['item com edição desconhecida', { ...snapshot, items: [{ ...snapshot.items[0], edition: '1/3' }] }],
    ['item com quantidade inválida', { ...snapshot, items: [{ ...snapshot.items[0], quantity: 0 }] }],
    ['valor que não é decimal', { ...snapshot, total: '1e3' }],
    ['valor numérico', { ...snapshot, subtotal: 1.12 }],
    ['cupom malformado', { ...snapshot, coupon: { code: 'X', status: 'usado' } }],
  ])('%s vira undefined', (_, value) => {
    expect(parseAttemptSnapshot(value)).toBeUndefined()
  })
})

describe('snapshot no rascunho', () => {
  it('withOrderKey grava o snapshot com a tentativa; chave nova sem snapshot tira o da anterior', () => {
    const { draft } = withOrderKey({ walletId: 'w1' }, { quoteId: 'q1', walletId: 'w1' }, () => 'key-1', snapshot)
    expect(draft.attemptSnapshot).toEqual(snapshot)
    expect(pendingAttempt(draft)).toEqual({ key: 'key-1', body: { quoteId: 'q1', walletId: 'w1' } })
    expect(withOrderKey(draft, { quoteId: 'q2', walletId: 'w1' }, () => 'key-2').draft.attemptSnapshot).toBeUndefined()
  })

  it('snapshot de outra cotação não é gravado', () => {
    const { draft } = withOrderKey({}, { quoteId: 'q2', walletId: 'w1' }, () => 'key-1', snapshot)
    expect(draft.attemptSnapshot).toBeUndefined()
  })

  it('persiste com a tentativa e sobrevive a um refresh', () => {
    const storage = memory()
    writeCheckoutDraft(storage, 'ana', pendingDraft)
    expect(readCheckoutDraft(storage, 'ana')).toEqual(pendingDraft)
  })

  it('sem tentativa, malformado ou de outra cotação: o snapshot cai e a tentativa fica', () => {
    expect(parseCheckoutDraft(JSON.stringify({ walletId: 'w1', attemptSnapshot: snapshot }))).toEqual({ walletId: 'w1' })
    const broken = parseCheckoutDraft(JSON.stringify({ ...pendingDraft, attemptSnapshot: { ...snapshot, total: 'x' } }))
    expect(broken.attemptSnapshot).toBeUndefined()
    expect(pendingAttempt(broken)?.key).toBe('key-1')
    const other = parseCheckoutDraft(JSON.stringify({ ...pendingDraft, attemptSnapshot: { ...snapshot, quoteId: 'q9' } }))
    expect(other.attemptSnapshot).toBeUndefined()
    expect(pendingAttempt(other)?.key).toBe('key-1')
  })

  it('withOrderId mantém; withoutOrderKey (409, fatal, declined) tira junto com a tentativa', () => {
    expect(withOrderId(pendingDraft, 'key-1', 'o1').attemptSnapshot).toEqual(snapshot)
    expect(withoutOrderKey(pendingDraft)).toEqual({ walletId: 'w1', connectedWalletId: 'w1' })
  })

  it('settleCheckoutDraft: declined tira o snapshot; confirmed limpa tudo', () => {
    const store = createDraftStore('ana', null)
    store.set({ ...pendingDraft, orderId: 'o1' })
    settleCheckoutDraft(store, { id: 'o1', status: 'declined' })
    expect(store.get()).toEqual({ walletId: 'w1', connectedWalletId: 'w1' })
    store.set({ ...pendingDraft, orderId: 'o1' })
    settleCheckoutDraft(store, { id: 'o1', status: 'confirmed' })
    expect(store.get()).toEqual({})
  })

  it('withoutConnection (reset da sessão) mantém o snapshot com a tentativa (MYK-1103)', () => {
    const next = withoutConnection(pendingDraft)
    expect(next.connectedWalletId).toBeUndefined()
    expect(next.attemptSnapshot).toEqual(snapshot)
  })

  it('dropWalletConnections mantém o snapshot no storage e na cópia em memória', () => {
    const storage = memory()
    writeCheckoutDraft(storage, 'ana', pendingDraft)
    const store = checkoutDraftStore('ana-snapshot-mem')
    store.set(pendingDraft)
    dropWalletConnections(storage)
    const stored = readCheckoutDraft(storage, 'ana')
    expect(stored.connectedWalletId).toBeUndefined()
    expect(stored.attemptSnapshot).toEqual(snapshot)
    expect(store.get().connectedWalletId).toBeUndefined()
    expect(store.get().attemptSnapshot).toEqual(snapshot)
    store.clear()
  })
})

describe('reviewSource (o que a Revisão mostra)', () => {
  const currentCart = [{ nftId: 'nft-002', edition: '1/10' as const, quantity: 5 }, { nftId: 'nft-010', edition: '1/1' as const, quantity: 1 }]

  it('com tentativa pendente e o carrinho alterado: os itens e valores da tentativa', () => {
    const source = reviewSource(currentCart, pendingDraft)
    expect(source.kind).toBe('attempt')
    expect(source.items).toEqual(quote.items)
    if (source.kind === 'attempt') expect(source.snapshot.total).toBe('1.011')
  })

  it('também com o pedido já criado (orderId) e sem a conexão (depois do logout)', () => {
    expect(reviewSource(currentCart, withoutConnection({ ...pendingDraft, orderId: 'o1' })).kind).toBe('attempt')
  })

  it('sem tentativa: o carrinho atual', () => {
    expect(reviewSource(currentCart, { walletId: 'w1', attemptSnapshot: snapshot })).toEqual({ kind: 'cart', items: currentCart })
    expect(reviewSource(currentCart, withoutOrderKey(pendingDraft))).toEqual({ kind: 'cart', items: currentCart })
  })

  it('rascunho antigo, com tentativa e sem snapshot: o carrinho atual (comportamento anterior)', () => {
    const legacy = { ...pendingDraft }
    delete legacy.attemptSnapshot
    expect(pendingAttemptSnapshot(legacy)).toBeUndefined()
    expect(reviewSource(currentCart, legacy)).toEqual({ kind: 'cart', items: currentCart })
  })
})
