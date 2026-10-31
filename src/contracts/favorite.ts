import type { Id, IsoDateTime } from './common'

/** `GET /favorites` (lista `Favorite[]`), `PUT /favorites/:nftId` e `DELETE /favorites/:nftId` (idempotentes). */
export interface Favorite {
  nftId: Id
  createdAt: IsoDateTime
}
