import { queryOptions } from '@tanstack/react-query'
import type { CreateOrderRequest, Id, Order } from '@/contracts'
import { apiClient } from './client'

/** Isolada por conta (a raiz `orders` é privada). */
export const orderKeys = {
  all: ['orders'] as const,
  detail: (accountId: Id, orderId: Id) => ['orders', accountId, orderId] as const,
}

/** `GET /orders/:orderId` (403 pedido de outra conta, 404 inexistente). */
export function orderQuery(accountId: Id, orderId: Id) {
  return queryOptions({
    queryKey: orderKeys.detail(accountId, orderId),
    queryFn: async ({ signal }) =>
      (await apiClient.get<Order>(`/orders/${encodeURIComponent(orderId)}`, { signal })).data,
  })
}

/**
 * `POST /orders` com `Idempotency-Key` obrigatória: 201 cria; a mesma chave com o mesmo payload devolve o
 * mesmo pedido (200). Quem chama gera e guarda a chave, e a reenvia ao repetir a mesma tentativa.
 */
export const createOrder = (body: CreateOrderRequest, idempotencyKey: string) =>
  apiClient
    .post<Order>('/orders', body, { headers: { 'Idempotency-Key': idempotencyKey } })
    .then((r) => r.data)
