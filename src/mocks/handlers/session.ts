import type { Id } from '@/contracts'
import type { MockDb } from '../db/schema'
import { store } from '../runtime'
import { apiError, raise } from './errors'

export interface ActiveSession {
  token: string
  accountId: Id
  expiresAt: string
}

export function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') ?? '')
  return match ? match[1] : null
}

/** Sessão válida para o token, ou `null` (desconhecida, expirada ou de conta inexistente). */
export function findSession(db: MockDb, token: string | null, now = Date.now()): ActiveSession | null {
  if (!token) return null
  const session = db.sessions[token]
  if (!session || Date.parse(session.expiresAt) <= now) return null
  if (!(session.accountId in db.users)) return null
  return { token, accountId: session.accountId, expiresAt: session.expiresAt }
}

/** Devolve a sessão do `Authorization: Bearer`; ausente ou expirada lança 401 `unauthorized`. */
export function requireSession(request: Request): ActiveSession {
  const session = findSession(store.getDb(), bearerToken(request))
  if (!session) raise(apiError(401, 'unauthorized', 'Sessão ausente ou expirada.'))
  return session
}

/** Recurso de outra conta lança 403 `forbidden`. */
export function assertOwner(session: Pick<ActiveSession, 'accountId'>, ownerAccountId: Id): void {
  if (session.accountId !== ownerAccountId) {
    raise(apiError(403, 'forbidden', 'Este recurso pertence a outra conta.'))
  }
}
