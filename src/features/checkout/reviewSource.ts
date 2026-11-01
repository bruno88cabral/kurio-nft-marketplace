import type { CartItem } from '@/contracts'
import type { AttemptSnapshot } from './attemptSnapshot'
import { pendingAttemptSnapshot, type CheckoutDraft } from './checkoutDraft'

/** Aviso da Revisão quando ela mostra a tentativa pendente em vez do carrinho atual. */
export const ATTEMPT_REVIEW_MESSAGE =
  'Estes são os itens e valores do pedido enviado. Mudanças no carrinho valem para a próxima compra.'

export type ReviewSource =
  /** Tentativa pendente com snapshot: a Revisão e o resumo mostram o que "Tentar de novo" compra. */
  | { kind: 'attempt'; items: AttemptSnapshot['items']; snapshot: AttemptSnapshot }
  /** Sem tentativa, ou rascunho antigo sem snapshot: o carrinho atual com a cotação dele. */
  | { kind: 'cart'; items: readonly CartItem[] }

/** O que a Revisão do Pagamento mostra. Só escolhe a origem: nenhum valor é calculado. */
export function reviewSource(cartItems: readonly CartItem[], draft: CheckoutDraft): ReviewSource {
  const snapshot = pendingAttemptSnapshot(draft)
  return snapshot ? { kind: 'attempt', items: snapshot.items, snapshot } : { kind: 'cart', items: cartItems }
}
