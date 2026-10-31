import { setupWorker } from 'msw/browser'
import { authHandlers } from './handlers/auth'
import { favoriteHandlers } from './handlers/favorites'
import { healthHandlers } from './handlers/health'
import { nftHandlers } from './handlers/nfts'
import { profileHandlers } from './handlers/profile'
import { walletHandlers } from './handlers/wallets'
import { socketHandlers } from './socket'

const restHandlers = [
  ...healthHandlers,
  ...authHandlers,
  ...nftHandlers,
  ...favoriteHandlers,
  ...profileHandlers,
  ...walletHandlers,
]

export const worker = setupWorker(...restHandlers, ...socketHandlers)
