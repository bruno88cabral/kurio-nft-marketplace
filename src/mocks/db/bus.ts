import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/contracts'

/**
 * O que o `mutate` publica: um evento por recurso `nft`/`order` tocado, já no formato do contrato
 * (`eventId` UUID, `version` do `db.versions`), depois de gravar no storage. `reset` avisa que o db
 * voltou ao seed (versões zeradas).
 */
export type BusEvent =
  | { name: 'nft.updated'; event: NftUpdatedEvent }
  | { name: 'order.updated'; event: OrderUpdatedEvent }
  | { name: 'reset' }

export type BusListener = (event: BusEvent) => void

export interface Bus {
  publish: (event: BusEvent) => void
  /** Devolve a função que cancela a inscrição. */
  subscribe: (listener: BusListener) => () => void
}

export function createBus(): Bus {
  const listeners = new Set<BusListener>()
  return {
    publish: (event) => {
      for (const listener of [...listeners]) listener(event)
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
