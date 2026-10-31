import type { Id, Nft } from '@/contracts'
import { parseEth } from '@/lib/eth'
import type { Store } from './db/store'
import { isScenarioName, type ScenarioName } from './scenarios'

/** Hook de teste e demonstração (`window.__kurioMock`). Tudo passa pelo store e pelo bus, nunca pela UI. */
export interface KurioMock {
  /** Volta o db ao seed e recarrega a página; com `scenario`, troca o cenário no mesmo passo. */
  reset: (scenario?: ScenarioName) => void
  /** Persiste o cenário e recarrega (o db recomeça do seed do novo cenário). */
  setScenario: (name: ScenarioName) => void
  /** Cenário ativo nesta página. */
  scenario: ScenarioName
  emit: {
    /** Altera preço e/ou estoque do NFT via `mutate`: o bus publica `nft.updated` com `version` maior. */
    nftUpdated: (nftId: Id, patch: { price?: string; editions?: Nft['editions'] }) => void
    /** Toca o pedido: re-publica o estado atual com `version` + 1. */
    orderUpdated: (orderId: Id) => void
  }
  /** Re-publica o último `nft.updated`/`order.updated` com o MESMO `eventId` e `version` (entrega duplicada). */
  duplicateLast: () => void
}

export interface DevtoolsDeps {
  store: Store
  scenario: ScenarioName
  /** Grava o cenário escolhido para a próxima carga (a chave é a de `runtime.ts`). */
  persistScenario: (name: ScenarioName) => void
  reload: () => void
}

export function createKurioMock({ store, scenario, persistScenario, reload }: DevtoolsDeps): KurioMock {
  const assertScenario = (name: string): ScenarioName => {
    if (!isScenarioName(name)) throw new Error(`Cenário desconhecido: "${name}"`)
    return name
  }

  return {
    scenario,
    reset: (next) => {
      // Valida antes de mexer no db: um nome inválido não pode deixar o reset pela metade
      const name = next === undefined ? undefined : assertScenario(next)
      store.reset()
      if (name !== undefined) persistScenario(name)
      reload()
    },
    setScenario: (name) => {
      persistScenario(assertScenario(name))
      reload()
    },
    emit: {
      nftUpdated: (nftId, patch) => {
        const price = patch.price === undefined ? undefined : parseEth(patch.price)
        store.mutate((db, touch) => {
          const nft = db.nfts[nftId]
          if (!nft) throw new Error(`NFT inexistente: "${nftId}"`)
          if (price !== undefined) nft.price = price
          if (patch.editions !== undefined) nft.editions = patch.editions
          touch('nft', nftId)
        })
      },
      orderUpdated: (orderId) => {
        store.mutate((db, touch) => {
          if (!db.orders[orderId]) throw new Error(`Pedido inexistente: "${orderId}"`)
          touch('order', orderId)
        })
      },
    },
    duplicateLast: () => {
      const last = store.bus.last()
      if (!last) throw new Error('Nenhum evento publicado ainda.')
      store.bus.publish(last)
    },
  }
}
