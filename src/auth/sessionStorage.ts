import type { IsoDateTime } from '@/contracts'

export const SESSION_STORAGE_KEY = 'kurio:session'

/** Subconjunto de `Storage` usado aqui; injetável nos testes (como no mock). */
export type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface StoredSession {
  token: string
  expiresAt: IsoDateTime
}

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false
  const { token, expiresAt } = value as Record<string, unknown>
  return typeof token === 'string' && token !== '' && typeof expiresAt === 'string'
}

/** Sessão guardada, ou `null` se ausente, ilegível, malformada ou expirada. Nunca lança. */
export function readSession(storage: SessionStorageLike, now = Date.now()): StoredSession | null {
  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredSession(parsed)) return null
    const expires = Date.parse(parsed.expiresAt)
    if (Number.isNaN(expires) || expires <= now) return null
    return { token: parsed.token, expiresAt: parsed.expiresAt }
  } catch {
    return null
  }
}

/** Storage bloqueado/cheio não quebra o app: a sessão só não persiste. */
export function writeSession(storage: SessionStorageLike, session: StoredSession): void {
  try {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: session.token, expiresAt: session.expiresAt }))
  } catch {
    // sem persistência
  }
}

export function clearSession(storage: SessionStorageLike): void {
  try {
    storage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // sem persistência
  }
}

/** `localStorage`, ou `null` quando indisponível (node, storage bloqueado). */
export function browserStorage(): SessionStorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Token da sessão válida no `localStorage`, ou `null`. */
export function getToken(): string | null {
  const storage = browserStorage()
  return storage ? (readSession(storage)?.token ?? null) : null
}

/** Remove a sessão do `localStorage` (no-op se indisponível). */
export function clearStoredSession(): void {
  const storage = browserStorage()
  if (storage) clearSession(storage)
}
