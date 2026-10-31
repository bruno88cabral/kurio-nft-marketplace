import type { Id, Network } from '@/contracts'
import type { Scenario } from '../scenarios'
import type { Store } from './store'

export const DEFAULT_SETTLE_MS = 3_000

const EXPLORERS: Record<Network, string> = {
  ethereum: 'https://etherscan.io/tx/',
  polygon: 'https://polygonscan.com/tx/',
  arbitrum: 'https://arbiscan.io/tx/',
  optimism: 'https://optimistic.etherscan.io/tx/',
}

export interface OrderLifecycleOptions {
  store: Store
  scenario: Pick<Scenario, 'rules'>
  now?: () => Date
}

export interface OrderLifecycle {
  /** Arma o timer que leva o pedido `pending` ao estado final. No-op se já houver timer para ele. */
  scheduleOrder: (orderId: Id) => void
  /** Re-arma o timer de todo `pending` persistido (após refresh). */
  resumePendingOrders: () => void
  /** Aplica a transição agora. `false` se o pedido não existe ou não está mais `pending`. */
  settleOrder: (orderId: Id) => boolean
}

const fakeTxHash = () => `0x${(crypto.randomUUID() + crypto.randomUUID()).replaceAll('-', '').slice(0, 64)}`

export function createOrderLifecycle({ store, scenario, now = () => new Date() }: OrderLifecycleOptions): OrderLifecycle {
  const timers = new Map<Id, ReturnType<typeof setTimeout>>()
  const settleMs = scenario.rules?.orderSettleMs ?? DEFAULT_SETTLE_MS

  const settleOrder: OrderLifecycle['settleOrder'] = (orderId) => {
    timers.delete(orderId)
    return store.mutate((db, touch) => {
      const order = db.orders[orderId]
      // Terminais: `confirmed`/`declined` nunca voltam nem se repetem (estoque baixa uma vez)
      if (order?.status !== 'pending') return false

      order.updatedAt = now().toISOString()
      if (scenario.rules?.paymentDeclined) {
        order.status = 'declined'
      } else {
        order.status = 'confirmed'
        order.txHash = fakeTxHash()
        order.explorerUrl = `${EXPLORERS[order.network]}${order.txHash}`

        const cart = db.carts[order.accountId]
        for (const item of order.items) {
          const nft = db.nfts[item.nftId]
          const edition = nft?.editions.find((e) => e.kind === item.edition)
          if (nft && edition) {
            edition.available = Math.max(0, edition.available - item.quantity)
            touch('nft', nft.id)
          }
          // Só o que foi comprado sai do carrinho; o que sobrou da linha fica
          const line = cart?.items.find((i) => i.nftId === item.nftId && i.edition === item.edition)
          if (cart && line) {
            line.quantity -= item.quantity
            if (line.quantity <= 0) cart.items = cart.items.filter((i) => i !== line)
          }
        }
        touch('cart', order.accountId)
      }
      touch('order', order.id)
      return true
    })
  }

  const arm = (orderId: Id, delayMs: number) => {
    if (timers.has(orderId)) return
    timers.set(
      orderId,
      setTimeout(() => {
        settleOrder(orderId)
      }, delayMs),
    )
  }

  return {
    settleOrder,
    scheduleOrder: (orderId) => arm(orderId, settleMs),
    resumePendingOrders: () => {
      const at = now().getTime()
      for (const order of Object.values(store.getDb().orders)) {
        if (order.status !== 'pending') continue
        // Desconta o que já passou desde a criação; pedido antigo conclui logo
        arm(order.id, Math.max(0, Date.parse(order.createdAt) + settleMs - at))
      }
    },
  }
}
