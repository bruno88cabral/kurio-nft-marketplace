import type { SessionStorageLike } from '@/auth/sessionStorage'
import type { CreateOrderRequest, Id, Order } from '@/contracts'

/** Rascunho do checkout em `sessionStorage` (morre com a aba; não vaza para outra aba nem outro login). */
export const checkoutDraftKey = (accountId: Id) => `kurio:checkout:${accountId}`

export interface CheckoutDraft {
  /** Carteira escolhida no Pagamento. */
  walletId?: Id
  /** Carteira cuja conexão (`POST /wallets/:id/connect`) deu certo. Só vale se for a escolhida. */
  connectedWalletId?: Id
  /** Chave da tentativa de pedido ainda sem resposta final (`Idempotency-Key`). */
  idempotencyKey?: string
  /** `quoteId:walletId` da tentativa: a chave só é reaproveitada com o mesmo par. */
  keyFingerprint?: string
  /**
   * O corpo da tentativa (`{ quoteId, walletId }`). Fica junto da chave para reenviar **o mesmo** pedido
   * depois de um refresh: com o corpo diferente a mesma chave daria 409.
   */
  attempt?: CreateOrderRequest
  /**
   * Id do pedido que a tentativa criou (201, ou 200 ao reenviar a mesma chave). Com ele o checkout sabe que o
   * pedido existe e consulta o estado em vez de pedir "Tentar de novo"; o `order.updated` final limpa o
   * rascunho mesmo com a Confirmação fechada. Só vale junto da tentativa.
   */
  orderId?: Id
}

const isString = (value: unknown): value is string => typeof value === 'string' && value !== ''

function isAttempt(value: unknown): value is CreateOrderRequest {
  if (typeof value !== 'object' || value === null) return false
  const { quoteId, walletId } = value as Record<string, unknown>
  return isString(quoteId) && isString(walletId)
}

/** Só os campos válidos do JSON guardado; ausente, ilegível ou malformado vira `{}`. Nunca lança. */
export function parseCheckoutDraft(raw: string | null): CheckoutDraft {
  if (raw === null) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const value = parsed as Record<string, unknown>
    const draft: CheckoutDraft = {}
    if (isString(value.walletId)) draft.walletId = value.walletId
    if (isString(value.connectedWalletId)) draft.connectedWalletId = value.connectedWalletId
    // A chave só serve com o corpo e o fingerprint dela: metade de uma tentativa é descartada
    if (isString(value.idempotencyKey) && isString(value.keyFingerprint) && isAttempt(value.attempt)) {
      draft.idempotencyKey = value.idempotencyKey
      draft.keyFingerprint = value.keyFingerprint
      draft.attempt = { quoteId: value.attempt.quoteId, walletId: value.attempt.walletId }
      if (isString(value.orderId)) draft.orderId = value.orderId
    }
    return draft
  } catch {
    return {}
  }
}

export function readCheckoutDraft(storage: SessionStorageLike | null, accountId: Id): CheckoutDraft {
  if (!storage) return {}
  try {
    return parseCheckoutDraft(storage.getItem(checkoutDraftKey(accountId)))
  } catch {
    return {}
  }
}

/** Storage bloqueado ou cheio só deixa o rascunho sem persistir (a tela segue com o estado em memória). */
export function writeCheckoutDraft(storage: SessionStorageLike | null, accountId: Id, draft: CheckoutDraft): void {
  if (!storage) return
  try {
    storage.setItem(checkoutDraftKey(accountId), JSON.stringify(draft))
  } catch {
    // sem persistência
  }
}

export function clearCheckoutDraft(storage: SessionStorageLike | null, accountId: Id): void {
  if (!storage) return
  try {
    storage.removeItem(checkoutDraftKey(accountId))
  } catch {
    // nada a limpar
  }
}

/** `sessionStorage` do browser, ou `null` (SSR, testes em node, storage bloqueado). */
export function browserSessionStorage(): SessionStorageLike | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

export const keyFingerprint = (attempt: CreateOrderRequest) => `${attempt.quoteId}:${attempt.walletId}`

/**
 * Chave da tentativa: a guardada se o par cotação+carteira é o mesmo (repetir a mesma tentativa nunca cria
 * outro pedido); senão uma nova. Devolve o rascunho já com a chave, o fingerprint e o corpo, para gravar
 * **antes** do POST.
 */
export function withOrderKey(
  draft: CheckoutDraft,
  attempt: CreateOrderRequest,
  newKey: () => string = () => crypto.randomUUID(),
): { key: string; draft: CheckoutDraft } {
  const fingerprint = keyFingerprint(attempt)
  const reused = draft.idempotencyKey && draft.keyFingerprint === fingerprint ? draft.idempotencyKey : undefined
  const key = reused ?? newKey()
  const next: CheckoutDraft = { ...draft, idempotencyKey: key, keyFingerprint: fingerprint, attempt: { ...attempt } }
  // Chave nova é outra tentativa: o pedido da anterior não é dela
  if (!reused) delete next.orderId
  return { key, draft: next }
}

/**
 * Resposta do `POST /wallets/:id/connect` da carteira `walletId`: marca como conectada **só** se ela ainda é a
 * escolhida. Se a pessoa trocou de carteira durante a conexão, devolve `undefined` (a resposta atrasada não
 * desfaz a troca). Sem `walletId` no rascunho a escolhida é a principal, que é a que foi conectada.
 */
export function withConnectedWallet(draft: CheckoutDraft, walletId: Id): CheckoutDraft | undefined {
  if (draft.walletId !== undefined && draft.walletId !== walletId) return undefined
  return { ...draft, walletId, connectedWalletId: walletId }
}

/** Grava o pedido criado na tentativa da chave `key`; outra tentativa (ou nenhuma) fica como está. */
export function withOrderId(draft: CheckoutDraft, key: string, orderId: Id): CheckoutDraft {
  return draft.idempotencyKey === key && draft.attempt ? { ...draft, orderId } : draft
}

/** Sem a tentativa (409 de revalidação, pedido recusado): a próxima confirmação usa uma chave nova. */
export function withoutOrderKey(draft: CheckoutDraft): CheckoutDraft {
  const next = { ...draft }
  delete next.idempotencyKey
  delete next.keyFingerprint
  delete next.attempt
  delete next.orderId
  return next
}

/** O pedido é o da tentativa guardada? Pelo `orderId` gravado no 201, ou pela chave (quando o pedido a traz). */
export function draftOwnsOrder(draft: CheckoutDraft, order: Pick<Order, 'id'> & { idempotencyKey?: string }): boolean {
  if (!pendingAttempt(draft)) return false
  if (draft.orderId !== undefined && draft.orderId === order.id) return true
  return order.idempotencyKey !== undefined && draft.idempotencyKey === order.idempotencyKey
}

/**
 * Efeito do estado final de um pedido no rascunho, idempotente. Só age se o pedido é o da tentativa guardada
 * (abrir um pedido antigo não apaga a atual):
 * - `confirmed`: limpa o rascunho inteiro;
 * - `declined`: tira só a tentativa (a cotação pode ser reusada, a chave não; a carteira fica).
 * `pending` não faz nada. Usado pela Confirmação (`applyOrderOutcome`), pelo `order.updated` e pelo checkout.
 */
export function settleCheckoutDraft(
  drafts: CheckoutDraftStore,
  order: Pick<Order, 'id' | 'status'> & { idempotencyKey?: string },
): void {
  if (order.status === 'pending') return
  const draft = drafts.get()
  if (!draftOwnsOrder(draft, order)) return
  if (order.status === 'confirmed') drafts.clear()
  else drafts.set(withoutOrderKey(draft))
}

/** Tentativa ainda sem resposta final, para "Tentar de novo" com a mesma chave (inclusive depois de refresh). */
export function pendingAttempt(draft: CheckoutDraft): { key: string; body: CreateOrderRequest } | undefined {
  if (!draft.idempotencyKey || !draft.attempt || draft.keyFingerprint !== keyFingerprint(draft.attempt)) return undefined
  return { key: draft.idempotencyKey, body: draft.attempt }
}

/** Interface mínima de leitura/escrita do rascunho, injetável nos testes. */
export interface CheckoutDraftStore {
  get: () => CheckoutDraft
  set: (draft: CheckoutDraft) => void
  clear: () => void
}

export interface ObservableDraftStore extends CheckoutDraftStore {
  subscribe: (listener: () => void) => () => void
}

/**
 * Rascunho da conta com cópia em memória (a tela continua funcionando com o storage bloqueado) e
 * `subscribe` para o `useSyncExternalStore`. Toda escrita vai para o `sessionStorage` na hora.
 */
export function createDraftStore(accountId: Id, storage: SessionStorageLike | null = browserSessionStorage()): ObservableDraftStore {
  let current = readCheckoutDraft(storage, accountId)
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())
  return {
    get: () => current,
    set: (draft) => {
      current = draft
      writeCheckoutDraft(storage, accountId, draft)
      emit()
    },
    clear: () => {
      current = {}
      clearCheckoutDraft(storage, accountId)
      emit()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const stores = new Map<Id, ObservableDraftStore>()

/** Uma instância por conta (Pagamento e Confirmação leem e escrevem o mesmo rascunho). */
export function checkoutDraftStore(accountId: Id): ObservableDraftStore {
  let store = stores.get(accountId)
  if (!store) {
    store = createDraftStore(accountId)
    stores.set(accountId, store)
  }
  return store
}
