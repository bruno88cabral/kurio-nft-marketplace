import { http, HttpResponse } from 'msw'
import { API_URL } from '@/app/env'
import type { CreateOrderRequest, Order } from '@/contracts'
import { applyQuoteDrift, createOrder, toOrder } from '../db/orders'
import { scheduleOrder } from '../lifecycle'
import { scenario, store } from '../runtime'
import { domainGuard } from './domain'
import { notFound, raise, readJson, str, validationError } from './errors'
import { assertOwner, requireSession } from './session'
import { withScenario } from './withScenario'

export const IDEMPOTENCY_HEADER = 'Idempotency-Key'

export const orderHandlers = [
  // `order-timeout`: o pedido é criado e o timer armado no resolver; só a RESPOSTA que o criou (201)
  // atrasa (> 10s do apiClient). O retry com a mesma chave (200) volta com a latência base.
  http.post(
    `${API_URL}/orders`,
    withScenario(
      'POST',
      '/orders',
      async ({ request }) => {
        const { accountId } = requireSession(request)
        const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER)?.trim()
        if (!idempotencyKey) {
          raise(
            validationError({ [IDEMPOTENCY_HEADER]: 'Header obrigatório.' }, `Informe o header ${IDEMPOTENCY_HEADER}.`),
          )
        }
        const raw = await readJson(request)
        const quoteId = str(raw.quoteId)
        const walletId = str(raw.walletId)
        if (!quoteId || !walletId) {
          raise(
            validationError({
              ...(quoteId ? {} : { quoteId: 'Informe a cotação.' }),
              ...(walletId ? {} : { walletId: 'Informe a carteira.' }),
            }),
          )
        }
        const body: CreateOrderRequest = { quoteId, walletId }

        // A mudança "depois da cotação" fica fora do mutate que valida: o rollback do 409 não a desfaz
        const rules = scenario.rules
        if (rules?.priceChangeAfterQuote || rules?.soldOutAfterQuote) {
          store.mutate((db, touch) => {
            applyQuoteDrift(db, touch, { accountId, idempotencyKey, body, rules })
          })
        }
        const { order, created } = domainGuard(() =>
          store.mutate((db, touch) => createOrder(db, touch, { accountId, idempotencyKey, body, now: new Date() })),
        )
        if (created) scheduleOrder(order.id)
        return HttpResponse.json<Order>(toOrder(order), { status: created ? 201 : 200 })
      },
      { slowRouteLatencyWhen: (response) => response.status === 201 },
    ),
  ),

  http.get(
    `${API_URL}/orders`,
    withScenario('GET', '/orders', ({ request }) => {
      const { accountId } = requireSession(request)
      const mine = Object.values(store.getDb().orders)
        .filter((o) => o.accountId === accountId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return HttpResponse.json<Order[]>(mine.map(toOrder))
    }),
  ),

  http.get(
    `${API_URL}/orders/:orderId`,
    withScenario('GET', '/orders/:orderId', ({ request, params }) => {
      const session = requireSession(request)
      const order = store.getDb().orders[String(params.orderId)]
      if (!order) raise(notFound('Pedido não encontrado.'))
      assertOwner(session, order.accountId)
      return HttpResponse.json<Order>(toOrder(order))
    }),
  ),
]
