import type { RealtimeEvent } from '@/contracts'

/** Quantos `eventId` o reconciliador lembra (FIFO): cobre com folga as duplicatas, que chegam logo depois do original. */
export const DEFAULT_MAX_SEEN_EVENTS = 500

export interface Reconciler {
  /**
   * `true` = aplicar; `false` = descartar (`eventId` já visto ou `version` <= a última aplicada do recurso).
   * Só um evento aceito conta: o descartado não entra no histórico.
   */
  accept: (event: RealtimeEvent<string, unknown>) => boolean
  /** Esquece os `eventId` e as versões (reset privado: login, logout, expiração e troca de conta). */
  reset: () => void
}

/**
 * Regras do R5, sem tela nem cache:
 * - **dedupe por `eventId`**: entrega duplicada (`__kurioMock.duplicateLast()`) é ignorada;
 * - **descarte por `version`**: a versão é monotônica por recurso (`'<tipo>:<id>'`), então um evento com versão
 *   menor ou igual à última aplicada é velho. Se o v3 chega antes do v2, o v2 é descartado depois.
 * O mapa de versões não tem limite: cresce com os recursos vistos (catálogo + pedidos da sessão), não com os eventos.
 */
export function createReconciler({ maxSeen = DEFAULT_MAX_SEEN_EVENTS }: { maxSeen?: number } = {}): Reconciler {
  // `Set` itera na ordem de inserção: o primeiro é o mais antigo (FIFO)
  const seen = new Set<string>()
  const versions = new Map<string, number>()

  return {
    accept: (event) => {
      if (seen.has(event.eventId)) return false
      const key = `${event.resource.type}:${event.resource.id}`
      const last = versions.get(key)
      if (last !== undefined && event.version <= last) return false

      seen.add(event.eventId)
      while (seen.size > maxSeen) {
        const oldest = seen.values().next().value
        if (oldest === undefined) break
        seen.delete(oldest)
      }
      versions.set(key, event.version)
      return true
    },
    reset: () => {
      seen.clear()
      versions.clear()
    },
  }
}
