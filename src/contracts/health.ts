import type { IsoDateTime } from './common'

/** Resposta de `GET /health`. Por enquanto só o mock responde (spike R1, MYK-1057). */
export interface HealthStatus {
  status: 'ok'
  mockedAt: IsoDateTime
}
