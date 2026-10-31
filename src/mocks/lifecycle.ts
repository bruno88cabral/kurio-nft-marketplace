import { createOrderLifecycle } from './db/orderLifecycle'
import { scenario, store } from './runtime'

/** Ciclo do pedido ligado ao store único da página. Os testes usam `createOrderLifecycle` direto. */
export const lifecycle = createOrderLifecycle({ store, scenario })
export const { scheduleOrder, resumePendingOrders } = lifecycle
