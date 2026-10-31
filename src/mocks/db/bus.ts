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
  /** Entrega a todos os inscritos. Um listener que lança não interrompe os demais nem quem publicou. */
  publish: (event: BusEvent) => void
  /** Devolve a função que cancela a inscrição. */
  subscribe: (listener: BusListener) => () => void
  /** Último `nft.updated`/`order.updated` publicado (o `reset` não conta); base do `duplicateLast`. */
  last: () => Exclude<BusEvent, { name: 'reset' }> | undefined
}

export function createBus(): Bus {
  const listeners = new Set<BusListener>()
  let last: Exclude<BusEvent, { name: 'reset' }> | undefined
  return {
    publish: (event) => {
      if (event.name !== 'reset') last = event
      for (const listener of [...listeners]) {
        try {
          listener(event)
        } catch (e) {
          // A mutação já foi commitada: falha na entrega a um inscrito não pode desfazê-la nem calar os outros
          console.error('[mocks] listener do bus falhou', e)
        }
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    last: () => last,
  }
}
