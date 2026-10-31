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
import { createKurioMock } from './devtools'
import { resumePendingOrders } from './lifecycle'
import { SCENARIO_STORAGE_KEY, scenario, store } from './runtime'
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

/** Expõe `window.__kurioMock`; só com mocks ligados (o módulo já só carrega nesse caso, a guarda é explícita). */
function installDevtools(): void {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return
  window.__kurioMock = createKurioMock({
    store,
    scenario: scenario.name,
    persistScenario: (name) => {
      try {
        localStorage.setItem(SCENARIO_STORAGE_KEY, name)
      } catch {
        // storage bloqueado: o cenário só vale via ?scenario=
      }
    },
    reload: () => location.reload(),
  })
}

/** Sobe o worker e re-arma os pedidos `pending` persistidos (um refresh não pode deixá-los parados). */
export async function startMocks(options: StartOptions = { onUnhandledRequest: 'bypass' }): Promise<void> {
  await worker.start(options)
  resumePendingOrders()
  installDevtools()
}
