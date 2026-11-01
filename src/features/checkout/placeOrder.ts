import type { QueryClient } from '@tanstack/react-query'
import { orderKeys } from '@/api/orders'
import { ApiError, type CreateOrderRequest, type Id, type Order, type Quote } from '@/contracts'
import { attemptSnapshotOf } from './attemptSnapshot'
import { pendingAttempt, withOrderId, withOrderKey, withoutOrderKey, type CheckoutDraftStore } from './checkoutDraft'
import { diffSnapshots, snapshotOf, type ReviewSnapshot, type SnapshotChange } from './reviewSnapshot'

export const TRANSIENT_ORDER_MESSAGE = 'Não confirmamos o envio.'
export const VALUES_CHANGED_MESSAGE = 'Os valores mudaram. Revise e confirme de novo.'
export const REQUOTE_FAILED_MESSAGE = 'Não foi possível atualizar a cotação. Tente de novo.'
export const ORDER_FAILED_MESSAGE = 'Não foi possível concluir o pedido. Tente de novo.'

/** Como tratar a falha do `POST /orders`. */
export type OrderErrorKind =
  /** Rede, timeout, 5xx: o pedido pode ter sido criado. Reenviar com a **mesma** chave. */
  | 'transient'
  /** 409 com `fieldErrors` por `nftId:edition` (preço, estoque, indisponível): volta à revisão. */
  | 'items'
  /** 409 sem `fieldErrors` (cotação vencida ou usada, chave com outro corpo): recotar e confirmar de novo. */
  | 'quote'
  /** Todo `ApiError` que não seja `transient` nem `conflict` (401, 403, 404, 422…): não adianta repetir (a tentativa é descartada). */
  | 'fatal'

export function classifyOrderError(error: unknown): OrderErrorKind {
  if (!(error instanceof ApiError)) return 'transient'
  if (error.code === 'transient') return 'transient'
  if (error.code === 'conflict') {
    return error.fieldErrors && Object.keys(error.fieldErrors).length > 0 ? 'items' : 'quote'
  }
  return 'fatal'
}

export type PlaceOrderOutcome =
  /** 201 ou 200 (mesma chave): o pedido está no cache, basta navegar. */
  | { kind: 'created'; order: Order }
  /** A recotação diverge do revisado: nada foi enviado; o snapshot passa a ser o novo. */
  | { kind: 'changed'; changes: SnapshotChange[]; quote: Quote; snapshot: ReviewSnapshot }
  /** A cotação tem `issues` (indisponível, preço alterado): nada foi enviado. */
  | { kind: 'blocked'; quote: Quote; snapshot: ReviewSnapshot }
  /** A recotação falhou: nada foi enviado. */
  | { kind: 'requote-failed'; error: unknown }
  /** Falha transitória do POST: a tentativa (chave + corpo) fica no rascunho. */
  | { kind: 'transient'; error: unknown }
  /** 409 por item: a chave foi descartada; a tela recota e mostra as mensagens. */
  | { kind: 'items'; fieldErrors: Record<string, string>; message: string }
  /** 409 da cotação: a chave foi descartada; a tela recota. */
  | { kind: 'quote'; message: string }
  /** Qualquer outro `ApiError` (401/403/404/422, ex.: carteira removida): a chave foi descartada; a tela mostra a mensagem e libera a carteira. */
  | { kind: 'fatal'; error: unknown }
  /** Login, logout ou expiração no meio: nada é gravado nem mostrado. */
  | { kind: 'stale-session' }

export interface PlaceOrderDeps {
  queryClient: QueryClient
  accountId: Id
  drafts: CheckoutDraftStore
  createOrder: (body: CreateOrderRequest, key: string) => Promise<Order>
  /** Padrão: `crypto.randomUUID()`. */
  newKey?: () => string
  /** "Ainda é a mesma sessão?", capturada no clique (`captureSession`). */
  sameSession?: () => boolean
}

/**
 * Envia a tentativa: grava a chave no rascunho **antes** do POST (um refresh no meio não perde a chave) e
 * trata a resposta. Sucesso vai para `orderKeys.detail` e grava o `orderId` na tentativa (o pedido existe: o
 * checkout passa a consultá-lo, e o `order.updated` final limpa o rascunho mesmo com a Confirmação fechada);
 * `transient` mantém a tentativa; 409 e `fatal` a descartam.
 */
async function send(deps: PlaceOrderDeps, key: string, body: CreateOrderRequest): Promise<PlaceOrderOutcome> {
  const same = deps.sameSession ?? (() => true)
  try {
    const order = await deps.createOrder(body, key)
    if (!same()) return { kind: 'stale-session' }
    deps.queryClient.setQueryData(orderKeys.detail(deps.accountId, order.id), order)
    deps.drafts.set(withOrderId(deps.drafts.get(), key, order.id))
    return { kind: 'created', order }
  } catch (error) {
    if (!same()) return { kind: 'stale-session' }
    const kind = classifyOrderError(error)
    if (kind === 'transient') return { kind: 'transient', error }
    // 409 e `fatal` (403/404/422): a tentativa não criou pedido (o servidor confere a idempotência antes da
    // cotação e da carteira; `src/mocks/db/orders.ts`). Repetir não adianta: a próxima confirmação é outra
    // tentativa, com outra chave. Sem isso a tela ficaria presa em "Tentar de novo"
    deps.drafts.set(withoutOrderKey(deps.drafts.get()))
    if (kind === 'fatal') return { kind: 'fatal', error }
    const apiError = error as ApiError
    return kind === 'items'
      ? { kind: 'items', fieldErrors: apiError.fieldErrors ?? {}, message: apiError.message }
      : { kind: 'quote', message: apiError.message }
  }
}

export interface ConfirmPurchaseInput {
  /** O que o usuário revisou (a cotação que estava na tela). */
  reviewed: ReviewSnapshot
  walletId: Id
  /** Recota (`refetch` da cotação) e devolve a cotação nova; rejeita se falhar. */
  requote: () => Promise<Quote>
}

/**
 * "Confirmar compra" (R3 + R4): recota, compara com o revisado e só envia se nada mudou e não há `issues`.
 * Depois reaproveita ou gera a chave (`withOrderKey`), grava no rascunho e envia.
 */
export async function confirmPurchase(deps: PlaceOrderDeps, input: ConfirmPurchaseInput): Promise<PlaceOrderOutcome> {
  // Tentativa sem resposta final no rascunho: o pedido pode existir. Uma recotação geraria outro `quoteId`,
  // outra chave e um segundo pedido; então só reenvia a mesma (a tela já mostra só "Tentar de novo")
  const pending = await resendPendingOrder(deps)
  if (pending) return pending

  const same = deps.sameSession ?? (() => true)
  let quote: Quote
  try {
    quote = await input.requote()
  } catch (error) {
    return same() ? { kind: 'requote-failed', error } : { kind: 'stale-session' }
  }
  if (!same()) return { kind: 'stale-session' }

  const snapshot = snapshotOf(quote)
  const changes = diffSnapshots(input.reviewed, snapshot)
  if (changes.length > 0) return { kind: 'changed', changes, quote, snapshot }
  if ((quote.issues?.length ?? 0) > 0) return { kind: 'blocked', quote, snapshot }

  const body: CreateOrderRequest = { quoteId: quote.quoteId, walletId: input.walletId }
  // O snapshot é da mesma cotação enviada (a que acabou de bater com o revisado): só para exibir a tentativa
  const { key, draft } = withOrderKey(deps.drafts.get(), body, deps.newKey, attemptSnapshotOf(quote))
  deps.drafts.set(draft)
  return send(deps, key, body)
}

/**
 * "Tentar de novo" depois de uma falha transitória (ou de um refresh com a tentativa gravada): reenvia o
 * **mesmo** corpo com a **mesma** chave, sem recotar (recotar mudaria o `quoteId` e criaria outro pedido).
 */
export async function resendPendingOrder(deps: PlaceOrderDeps): Promise<PlaceOrderOutcome | undefined> {
  const attempt = pendingAttempt(deps.drafts.get())
  if (!attempt) return undefined
  return send(deps, attempt.key, attempt.body)
}
