import type { Id } from '@/contracts'
import type { BusEvent } from './bus'
import type { MockDb } from './schema'

/**
 * Decide se uma conexão recebe o evento do bus. `accountId` é a conta do token da conexão
 * (`null` = anônima). `nft.updated` é público; `order.updated` só vai ao dono do pedido.
 * `reset` nunca sai pelo socket: não existe no contrato e a página recarrega depois dele.
 */
export function shouldDeliver(event: BusEvent, accountId: Id | null, orders: MockDb['orders']): boolean {
  if (event.name === 'nft.updated') return true
  if (event.name === 'order.updated') {
    return accountId !== null && orders[event.event.payload.id]?.accountId === accountId
  }
  return false
}
