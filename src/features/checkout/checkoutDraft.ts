import type { SessionStorageLike } from '@/auth/sessionStorage'
import type { CreateOrderRequest, Id, Order } from '@/contracts'
import { WALLET_PROVIDERS, type WalletProvider } from '@/lib/wallets'
import { parseAttemptSnapshot, type AttemptSnapshot } from './attemptSnapshot'
import { COLLECTOR_FIELDS, type CollectorValues } from './collectorForm'

/** Rascunho do checkout em `sessionStorage` (morre com a aba; não vaza para outra aba nem outro login). */
export const checkoutDraftKey = (accountId: Id) => `kurio:checkout:${accountId}`

export interface CheckoutDraft {
  /** Carteira escolhida no Pagamento. */
  walletId?: Id
  /**
   * Carteira cuja conexão (`POST /wallets/:id/connect`) deu certo. Só vale se for a escolhida. Cai no reset da
   * sessão (login, troca de conta, logout, expiração; `dropWalletConnections`, MYK-1103): a conexão é da sessão.
   */
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
  /**
   * Itens e valores da cotação enviada pela tentativa (`attemptSnapshotOf`). Só para exibir: com a tentativa
   * pendente, a Revisão e o resumo mostram o que "Tentar de novo" compra, não o carrinho atual. Só vale junto
   * da tentativa e com o mesmo `quoteId`; nunca muda o corpo nem a chave do reenvio.
   */
  attemptSnapshot?: AttemptSnapshot
  /**
   * Valores do formulário "Perfil do colecionador" (MYK-1114 D7), para sobreviverem a refresh e à expiração da
   * sessão. Dados privados: caem no logout explícito (`dropCollectorForms`, em `useSignOut`) e no `confirmed`
   * (`clear`), mas não no reset por expiração. Só exibição e validação no cliente: nunca entram no corpo do
   * pedido, na chave nem no snapshot da tentativa.
   */
  collector?: Partial<CollectorValues>
  /** Provedor com que a conexão é simulada (só de UI; o `connect` continua sendo do `walletId`). */
  provider?: WalletProvider
}

const isString = (value: unknown): value is string => typeof value === 'string' && value !== ''

function isAttempt(value: unknown): value is CreateOrderRequest {
  if (typeof value !== 'object' || value === null) return false
  const { quoteId, walletId } = value as Record<string, unknown>
  return isString(quoteId) && isString(walletId)
}

/** Teto de cada valor do formulário guardado (o maior campo, a Observação, vai até 500). */
const MAX_COLLECTOR_VALUE = 500

/** Só as chaves conhecidas com valor string (vazia vale: a pessoa pode ter apagado o pré-preenchido), truncadas. */
function parseCollector(value: unknown): Partial<CollectorValues> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const source = value as Record<string, unknown>
  const collector: Partial<CollectorValues> = {}
  for (const field of COLLECTOR_FIELDS) {
    const fieldValue = source[field]
    if (typeof fieldValue === 'string') collector[field] = fieldValue.slice(0, MAX_COLLECTOR_VALUE)
  }
  return Object.keys(collector).length > 0 ? collector : undefined
}

const isWalletProvider = (value: unknown): value is WalletProvider =>
  typeof value === 'string' && (WALLET_PROVIDERS as readonly string[]).includes(value)

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
      // Snapshot ausente, malformado ou de outra cotação: a tentativa fica, só sem o que exibir (rascunho antigo)
      const snapshot = parseAttemptSnapshot(value.attemptSnapshot)
      if (snapshot && snapshot.quoteId === draft.attempt.quoteId) draft.attemptSnapshot = snapshot
    }
    // Formulário e provedor malformados caem sozinhos, sem derrubar a carteira nem a tentativa
    const collector = parseCollector(value.collector)
    if (collector) draft.collector = collector
    if (isWalletProvider(value.provider)) draft.provider = value.provider
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
 * outro pedido); senão uma nova. Devolve o rascunho já com a chave, o fingerprint, o corpo e o `snapshot` do
 * que a tentativa compra (só para exibir), para gravar **antes** do POST. O snapshot não entra na chave nem no corpo.
 */
export function withOrderKey(
  draft: CheckoutDraft,
  attempt: CreateOrderRequest,
  newKey: () => string = () => crypto.randomUUID(),
  snapshot?: AttemptSnapshot,
): { key: string; draft: CheckoutDraft } {
  const fingerprint = keyFingerprint(attempt)
  const reused = draft.idempotencyKey && draft.keyFingerprint === fingerprint ? draft.idempotencyKey : undefined
  const key = reused ?? newKey()
  const next: CheckoutDraft = { ...draft, idempotencyKey: key, keyFingerprint: fingerprint, attempt: { ...attempt } }
  // Chave nova é outra tentativa: o pedido e o snapshot da anterior não são dela
  if (!reused) {
    delete next.orderId
    delete next.attemptSnapshot
  }
  if (snapshot && snapshot.quoteId === attempt.quoteId) next.attemptSnapshot = snapshot
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

/**
 * Sem a conexão da carteira, e só ela. `walletId` e a tentativa pendente (`idempotencyKey`, `keyFingerprint`,
 * `attempt`, `orderId`, `attemptSnapshot`) ficam: apagar a tentativa abriria caminho para um pedido duplicado depois de um timeout (R4).
 */
export function withoutConnection(draft: CheckoutDraft): CheckoutDraft {
  const next = { ...draft }
  delete next.connectedWalletId
  return next
}

/** Com os valores do formulário do colecionador (cópia); o resto do rascunho fica. */
export function withCollector(draft: CheckoutDraft, values: Partial<CollectorValues>): CheckoutDraft {
  return { ...draft, collector: { ...values } }
}

/** Sem o formulário do colecionador, e só ele: carteira, conexão, provedor e tentativa pendente ficam (R4). */
export function withoutCollector(draft: CheckoutDraft): CheckoutDraft {
  const next = { ...draft }
  delete next.collector
  return next
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
  delete next.attemptSnapshot
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

/**
 * Itens e valores que "Tentar de novo" compra: o snapshot da tentativa pendente. `undefined` sem tentativa ou
 * com rascunho antigo, sem snapshot (a tela segue mostrando o carrinho atual).
 */
export function pendingAttemptSnapshot(draft: CheckoutDraft): AttemptSnapshot | undefined {
  const pending = pendingAttempt(draft)
  if (!pending || !draft.attemptSnapshot || draft.attemptSnapshot.quoteId !== pending.body.quoteId) return undefined
  return draft.attemptSnapshot
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

const DRAFT_KEY_PREFIX = checkoutDraftKey('')

/** Chaves `kurio:checkout:*` do storage; storage que não lista (ou lança) devolve só o que se sabe. */
function draftStorageKeys(storage: SessionStorageLike): string[] {
  const listable = storage as Partial<Storage>
  if (typeof listable.length !== 'number' || typeof listable.key !== 'function') return []
  const found: string[] = []
  try {
    for (let i = 0; i < listable.length; i++) {
      const key = listable.key(i)
      if (key?.startsWith(DRAFT_KEY_PREFIX)) found.push(key)
    }
  } catch {
    // storage ilegível
  }
  return found
}

/**
 * Reset da sessão (login, troca de conta, logout, expiração): a conexão da carteira é da sessão e cai, a
 * tentativa pendente fica. O reset privado não diz de qual conta, então vale para todos os rascunhos
 * `kurio:checkout:*` da aba, no storage e nas cópias em memória (a tela abre com a cópia em memória).
 * Só reescreve o que tem conexão; não lança.
 */
export function dropWalletConnections(storage: SessionStorageLike | null = browserSessionStorage()): void {
  for (const store of stores.values()) {
    const draft = store.get()
    if (draft.connectedWalletId !== undefined) store.set(withoutConnection(draft))
  }
  if (!storage) return
  for (const key of draftStorageKeys(storage)) {
    try {
      const raw = storage.getItem(key)
      const draft = parseCheckoutDraft(raw)
      if (draft.connectedWalletId === undefined) continue
      storage.setItem(key, JSON.stringify(withoutConnection(draft)))
    } catch {
      // sem persistência
    }
  }
}

/**
 * Logout explícito (`useSignOut`, MYK-1114 D7): os valores do formulário do colecionador são dados privados e
 * caem; carteira, conexão (que o reset já tirou), provedor e tentativa pendente ficam (R4). Não é ouvinte do
 * `onPrivateReset`, porque o reset também roda na expiração e lá o formulário fica para a retomada. Vale para
 * todos os rascunhos `kurio:checkout:*` da aba e as cópias em memória. Só reescreve o que tem formulário; não lança.
 */
export function dropCollectorForms(storage: SessionStorageLike | null = browserSessionStorage()): void {
  for (const store of stores.values()) {
    const draft = store.get()
    if (draft.collector !== undefined) store.set(withoutCollector(draft))
  }
  if (!storage) return
  for (const key of draftStorageKeys(storage)) {
    try {
      const draft = parseCheckoutDraft(storage.getItem(key))
      if (draft.collector === undefined) continue
      storage.setItem(key, JSON.stringify(withoutCollector(draft)))
    } catch {
      // sem persistência
    }
  }
}
