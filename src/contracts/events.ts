import type { IsoDateTime } from './common'
import type { Nft } from './nft'
import type { Order } from './order'

export interface RealtimeEvent<TType extends string, TPayload> {
  eventId: string
  resource: { type: TType; id: string }
  /** Monotônica por recurso (R5). */
  version: number
  occurredAt: IsoDateTime
  payload: TPayload
}

export type NftUpdatedEvent = RealtimeEvent<'nft', Pick<Nft, 'id' | 'price' | 'editions'>>
export type OrderUpdatedEvent = RealtimeEvent<'order', Pick<Order, 'id' | 'status'>>

export interface ServerToClientEvents {
  'nft.updated': (e: NftUpdatedEvent) => void
  'order.updated': (e: OrderUpdatedEvent) => void
}

// O cliente não emite eventos; `interface {}` é rejeitada pelo lint (no-empty-object-type)
export type ClientToServerEvents = Record<string, never>
