import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { orderQuery } from '@/api/orders'
import type { Id, Order } from '@/contracts'
import { applyOrderOutcome } from '@/features/orders/orderStatus'
import { pendingAttempt, type CheckoutDraft, type CheckoutDraftStore } from './checkoutDraft'

export type PendingOrderState =
  /** Nenhuma tentativa pendente: o checkout segue normal. */
  | { kind: 'none' }
  /**
   * Tentativa sem resposta (timeout, rede): o pedido pode existir ou não. A única ação é "Tentar de novo" com a
   * mesma chave e o mesmo corpo (R4).
   */
  | { kind: 'unconfirmed' }
  /**
   * Tentativa com `orderId` (o 201/200 chegou): o pedido existe e ainda não tem estado final conhecido aqui.
   * Nada a reenviar; a tela aponta para a Confirmação. A carteira continua travada e não há chave nova.
   * `loadFailed`: a consulta do pedido falhou (rede, 5xx, até 404); `retry` consulta de novo. Nenhuma falha
   * descarta a tentativa: o pedido foi criado e só o servidor pode dizer o estado final (R4).
   */
  | { kind: 'in-progress'; orderId: Id; loadFailed: boolean; retrying: boolean; retry: () => void }

/**
 * O que a tentativa guardada no rascunho significa para o checkout. Com `orderId`, consulta o pedido
 * (`orderQuery`) e, se já está em estado final, aplica `applyOrderOutcome`: `confirmed` limpa o rascunho e
 * `declined` tira só a tentativa, liberando o checkout. Cobre o `order.updated` perdido (socket fora, aba que
 * reabriu) além do caminho normal pelo handler do evento.
 */
export function usePendingOrder(accountId: Id, draft: CheckoutDraft, drafts: CheckoutDraftStore): PendingOrderState {
  const queryClient = useQueryClient()
  const pending = pendingAttempt(draft)
  const orderId = pending ? draft.orderId : undefined
  const order = useQuery({ ...orderQuery(accountId, orderId ?? ''), enabled: orderId !== undefined })
  const known: Order | undefined = orderId !== undefined ? order.data : undefined

  useEffect(() => {
    if (known) applyOrderOutcome(queryClient, accountId, known, drafts)
  }, [queryClient, accountId, known, drafts])

  if (!pending) return { kind: 'none' }
  if (orderId === undefined) return { kind: 'unconfirmed' }
  return {
    kind: 'in-progress',
    orderId,
    loadFailed: order.isError,
    retrying: order.isError && order.isFetching,
    retry: () => void order.refetch(),
  }
}
