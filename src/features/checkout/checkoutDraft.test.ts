import { describe, expect, it } from 'vitest'
import type { SessionStorageLike } from '@/auth/sessionStorage'
import {
  checkoutDraftKey,
  checkoutDraftStore,
  createDraftStore,
  dropWalletConnections,
  draftOwnsOrder,
  parseCheckoutDraft,
  pendingAttempt,
  readCheckoutDraft,
  settleCheckoutDraft,
  withConnectedWallet,
  withoutConnection,
  withOrderId,
  withOrderKey,
  withoutOrderKey,
  writeCheckoutDraft,
} from './checkoutDraft'

function memory(): SessionStorageLike & Pick<Storage, 'key' | 'length'> & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
}

const keys = () => {
  let n = 0
  return () => `key-${++n}`
}

describe('withOrderKey', () => {
  it('reaproveita a chave com o mesmo par cotação+carteira', () => {
    const newKey = keys()
    const first = withOrderKey({}, { quoteId: 'q1', walletId: 'w1' }, newKey)
    const again = withOrderKey(first.draft, { quoteId: 'q1', walletId: 'w1' }, newKey)
    expect(first.key).toBe('key-1')
    expect(again.key).toBe('key-1')
    expect(again.draft).toMatchObject({ idempotencyKey: 'key-1', keyFingerprint: 'q1:w1', attempt: { quoteId: 'q1', walletId: 'w1' } })
  })

  it('troca a chave quando a cotação muda', () => {
    const newKey = keys()
    const first = withOrderKey({}, { quoteId: 'q1', walletId: 'w1' }, newKey)
    expect(withOrderKey(first.draft, { quoteId: 'q2', walletId: 'w1' }, newKey).key).toBe('key-2')
  })

  it('troca a chave quando a carteira muda', () => {
    const newKey = keys()
    const first = withOrderKey({}, { quoteId: 'q1', walletId: 'w1' }, newKey)
    const other = withOrderKey(first.draft, { quoteId: 'q1', walletId: 'w2' }, newKey)
    expect(other.key).toBe('key-2')
    expect(other.draft.keyFingerprint).toBe('q1:w2')
  })

  it('sem a tentativa (withoutOrderKey) a próxima chave é nova, e a carteira fica', () => {
    const newKey = keys()
    const first = withOrderKey({ walletId: 'w1', connectedWalletId: 'w1' }, { quoteId: 'q1', walletId: 'w1' }, newKey)
    const cleared = withoutOrderKey(first.draft)
    expect(cleared).toEqual({ walletId: 'w1', connectedWalletId: 'w1' })
    expect(withOrderKey(cleared, { quoteId: 'q1', walletId: 'w1' }, newKey).key).toBe('key-2')
  })

  it('usa crypto.randomUUID por padrão', () => {
    expect(withOrderKey({}, { quoteId: 'q1', walletId: 'w1' }).key).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('rascunho em sessionStorage', () => {
  it('grava em kurio:checkout:<accountId> e sobrevive a um "refresh" (nova leitura)', () => {
    const storage = memory()
    const { draft } = withOrderKey({ walletId: 'w1' }, { quoteId: 'q1', walletId: 'w1' }, () => 'k')
    writeCheckoutDraft(storage, 'user-ana', draft)
    expect(storage.map.has(checkoutDraftKey('user-ana'))).toBe(true)
    expect(checkoutDraftKey('user-ana')).toBe('kurio:checkout:user-ana')
    const reread = readCheckoutDraft(storage, 'user-ana')
    expect(pendingAttempt(reread)).toEqual({ key: 'k', body: { quoteId: 'q1', walletId: 'w1' } })
    expect(readCheckoutDraft(storage, 'user-bruno')).toEqual({})
  })

  it('JSON ilegível, forma errada ou tentativa pela metade não quebram', () => {
    expect(parseCheckoutDraft('{')).toEqual({})
    expect(parseCheckoutDraft('[1]')).toEqual({})
    expect(parseCheckoutDraft(JSON.stringify({ walletId: 3, idempotencyKey: 'k' }))).toEqual({})
    expect(parseCheckoutDraft(JSON.stringify({ walletId: 'w1', idempotencyKey: 'k', keyFingerprint: 'q:w' }))).toEqual({ walletId: 'w1' })
  })

  it('storage que lança vira rascunho em memória', () => {
    const broken: SessionStorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    const store = createDraftStore('user-ana', broken)
    store.set({ walletId: 'w1' })
    expect(store.get()).toEqual({ walletId: 'w1' })
    store.clear()
    expect(store.get()).toEqual({})
  })

  it('pendingAttempt exige chave, corpo e fingerprint coerentes', () => {
    expect(pendingAttempt({})).toBeUndefined()
    expect(
      pendingAttempt({ idempotencyKey: 'k', keyFingerprint: 'q2:w1', attempt: { quoteId: 'q1', walletId: 'w1' } }),
    ).toBeUndefined()
  })
})

const attemptDraft = (key = 'k1', orderId?: string) => ({
  walletId: 'w1',
  connectedWalletId: 'w1',
  idempotencyKey: key,
  keyFingerprint: 'q1:w1',
  attempt: { quoteId: 'q1', walletId: 'w1' },
  ...(orderId ? { orderId } : {}),
})

describe('orderId da tentativa (pedido já criado)', () => {
  it('withOrderId grava só na tentativa da mesma chave', () => {
    expect(withOrderId(attemptDraft('k1'), 'k1', 'o1')).toEqual(attemptDraft('k1', 'o1'))
    expect(withOrderId(attemptDraft('k2'), 'k1', 'o1')).toEqual(attemptDraft('k2'))
    expect(withOrderId({ walletId: 'w1' }, 'k1', 'o1')).toEqual({ walletId: 'w1' })
  })

  it('persiste com a tentativa e é descartado sem ela', () => {
    expect(parseCheckoutDraft(JSON.stringify(attemptDraft('k1', 'o1')))).toEqual(attemptDraft('k1', 'o1'))
    expect(parseCheckoutDraft(JSON.stringify({ walletId: 'w1', orderId: 'o1' }))).toEqual({ walletId: 'w1' })
  })

  it('chave nova (withOrderKey) e withoutOrderKey tiram o orderId; a mesma chave o mantém', () => {
    const draft = attemptDraft('k1', 'o1')
    expect(withOrderKey(draft, { quoteId: 'q1', walletId: 'w1' }, () => 'k9').draft.orderId).toBe('o1')
    expect(withOrderKey(draft, { quoteId: 'q2', walletId: 'w1' }, () => 'k9').draft.orderId).toBeUndefined()
    expect(withoutOrderKey(draft)).toEqual({ walletId: 'w1', connectedWalletId: 'w1' })
  })

  it('a tentativa com orderId continua pendente (nenhuma chave nova enquanto o pedido pode terminar)', () => {
    expect(pendingAttempt(attemptDraft('k1', 'o1'))).toEqual({ key: 'k1', body: { quoteId: 'q1', walletId: 'w1' } })
  })
})

describe('settleCheckoutDraft', () => {
  it('pelo orderId (order.updated) ou pela chave (pedido completo); nunca de outra tentativa', () => {
    expect(draftOwnsOrder(attemptDraft('k1', 'o1'), { id: 'o1' })).toBe(true)
    expect(draftOwnsOrder(attemptDraft('k1', 'o1'), { id: 'o2' })).toBe(false)
    expect(draftOwnsOrder(attemptDraft('k1'), { id: 'o1' })).toBe(false)
    expect(draftOwnsOrder(attemptDraft('k1'), { id: 'o1', idempotencyKey: 'k1' })).toBe(true)
    expect(draftOwnsOrder({ walletId: 'w1', orderId: 'o1' }, { id: 'o1' })).toBe(false)
  })

  it('confirmed limpa; declined tira só a tentativa; pending e outro pedido não mexem', () => {
    const store = createDraftStore('user-ana', null)
    store.set(attemptDraft('k1', 'o1'))
    settleCheckoutDraft(store, { id: 'o1', status: 'pending' })
    settleCheckoutDraft(store, { id: 'o2', status: 'confirmed' })
    expect(store.get()).toEqual(attemptDraft('k1', 'o1'))
    settleCheckoutDraft(store, { id: 'o1', status: 'declined' })
    expect(store.get()).toEqual({ walletId: 'w1', connectedWalletId: 'w1' })
    store.set(attemptDraft('k1', 'o1'))
    settleCheckoutDraft(store, { id: 'o1', status: 'confirmed' })
    expect(store.get()).toEqual({})
  })
})

describe('withConnectedWallet (resposta do connect)', () => {
  it('marca a carteira conectada se ela ainda é a escolhida (ou a principal, sem escolha)', () => {
    expect(withConnectedWallet({ walletId: 'w1' }, 'w1')).toEqual({ walletId: 'w1', connectedWalletId: 'w1' })
    expect(withConnectedWallet({}, 'w1')).toEqual({ walletId: 'w1', connectedWalletId: 'w1' })
  })

  it('a pessoa trocou de carteira durante a conexão: a resposta atrasada não desfaz a troca', () => {
    expect(withConnectedWallet({ walletId: 'w2' }, 'w1')).toBeUndefined()
  })
})

const pendingDraft = {
  walletId: 'w1',
  connectedWalletId: 'w1',
  idempotencyKey: 'key-1',
  keyFingerprint: 'q1:w1',
  attempt: { quoteId: 'q1', walletId: 'w1' },
  orderId: 'o1',
}

describe('withoutConnection', () => {
  it('tira só a conexão: a tentativa pendente e a carteira escolhida ficam (R4)', () => {
    const next = withoutConnection(pendingDraft)
    expect(next).not.toHaveProperty('connectedWalletId')
    expect(next).toEqual({
      walletId: 'w1',
      idempotencyKey: 'key-1',
      keyFingerprint: 'q1:w1',
      attempt: { quoteId: 'q1', walletId: 'w1' },
      orderId: 'o1',
    })
    expect(pendingAttempt(next)).toEqual({ key: 'key-1', body: { quoteId: 'q1', walletId: 'w1' } })
  })

  it('não muta o rascunho recebido', () => {
    withoutConnection(pendingDraft)
    expect(pendingDraft.connectedWalletId).toBe('w1')
  })
})

describe('dropWalletConnections (reset da sessão)', () => {
  it('o logout tira connectedWalletId e mantém a tentativa pendente', () => {
    const storage = memory()
    writeCheckoutDraft(storage, 'ana', pendingDraft)
    dropWalletConnections(storage)
    const after = readCheckoutDraft(storage, 'ana')
    expect(after.connectedWalletId).toBeUndefined()
    expect(after).toMatchObject({ walletId: 'w1', idempotencyKey: 'key-1', orderId: 'o1', attempt: { quoteId: 'q1', walletId: 'w1' } })
    expect(pendingAttempt(after)?.key).toBe('key-1')
  })

  it('vale para todas as contas da aba e não toca o que a regra não exige', () => {
    const storage = memory()
    writeCheckoutDraft(storage, 'ana', { walletId: 'w1', connectedWalletId: 'w1' })
    writeCheckoutDraft(storage, 'bruno', { walletId: 'w9' })
    storage.setItem('kurio:session', 'x')
    const brunoRaw = storage.getItem(checkoutDraftKey('bruno'))
    dropWalletConnections(storage)
    expect(readCheckoutDraft(storage, 'ana')).toEqual({ walletId: 'w1' })
    expect(storage.getItem(checkoutDraftKey('bruno'))).toBe(brunoRaw)
    expect(storage.getItem('kurio:session')).toBe('x')
  })

  it('storage ausente, ilegível ou que lança não quebra', () => {
    expect(() => dropWalletConnections(null)).not.toThrow()
    const storage = memory()
    storage.map.set(checkoutDraftKey('ana'), '{nao-json')
    expect(() => dropWalletConnections(storage)).not.toThrow()
    const throwing = {
      ...memory(),
      key: () => {
        throw new Error('bloqueado')
      },
      length: 1,
    }
    expect(() => dropWalletConnections(throwing)).not.toThrow()
  })

  it('a cópia em memória do store também perde a conexão e avisa os ouvintes', () => {
    const store = checkoutDraftStore('ana-mem')
    store.set(pendingDraft)
    let calls = 0
    store.subscribe(() => calls++)
    dropWalletConnections(null)
    expect(store.get().connectedWalletId).toBeUndefined()
    expect(pendingAttempt(store.get())?.key).toBe('key-1')
    expect(calls).toBe(1)
    dropWalletConnections(null)
    expect(calls).toBe(1)
    store.clear()
  })
})
