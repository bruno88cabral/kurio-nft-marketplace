import { setupWorker, type StartOptions } from 'msw/browser'
import { authHandlers } from './handlers/auth'
import { cartHandlers } from './handlers/cart'
import { favoriteHandlers } from './handlers/favorites'
import { healthHandlers } from './handlers/health'
import { nftHandlers } from './handlers/nfts'
import { orderHandlers } from './handlers/orders'
import { profileHandlers } from './handlers/profile'
import { quoteHandlers } from './handlers/quotes'
import { walletHandlers } from './handlers/wallets'
import { resumePendingOrders } from './lifecycle'
import { socketHandlers } from './socket'

const restHandlers = [
  ...healthHandlers,
  ...authHandlers,
  ...nftHandlers,
  ...favoriteHandlers,
  ...profileHandlers,
  ...walletHandlers,
  ...cartHandlers,
  ...quoteHandlers,
  ...orderHandlers,
]

export const worker = setupWorker(...restHandlers, ...socketHandlers)

/** Sobe o worker e re-arma os pedidos `pending` persistidos (um refresh não pode deixá-los parados). */
export async function startMocks(options: StartOptions = { onUnhandledRequest: 'bypass' }): Promise<void> {
  await worker.start(options)
  resumePendingOrders()
}
