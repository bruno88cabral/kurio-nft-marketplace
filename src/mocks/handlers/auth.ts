import { http, HttpResponse } from 'msw'
import { API_URL } from '@/app/env'
import type { AuthResponse, Id, Session } from '@/contracts'
import { newId } from '../db/ids'
import { hashPassword } from '../db/password'
import type { MockDb } from '../db/schema'
import { scenario, store } from '../runtime'
import { apiError, readJson, str, validationError, raise } from './errors'
import { bearerToken, requireSession } from './session'
import { withScenario } from './withScenario'

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000
export const MIN_PASSWORD_LENGTH = 8
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function randomSalt(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('')
}

function findByEmail(db: MockDb, email: string) {
  const wanted = email.trim().toLowerCase()
  return Object.values(db.users).find((u) => u.account.email.toLowerCase() === wanted)
}

/** Grava a sessão dentro de um `mutate` e devolve o `AuthResponse`. */
function openSession(db: MockDb, accountId: Id, touch: (type: 'session', id: string) => void): AuthResponse {
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + (scenario.rules?.sessionTtlMs ?? DEFAULT_TTL_MS)).toISOString()
  db.sessions[token] = { accountId, expiresAt }
  touch('session', token)
  return { token, expiresAt, account: { ...db.users[accountId].account } }
}

export const authHandlers = [
  http.post(
    `${API_URL}/auth/signup`,
    withScenario('POST', '/auth/signup', async ({ request }) => {
      const body = await readJson(request)
      const name = str(body.name)?.trim() ?? ''
      const email = str(body.email)?.trim() ?? ''
      const password = str(body.password) ?? ''

      const fieldErrors: Record<string, string> = {}
      if (!name) fieldErrors.name = 'Informe seu nome.'
      if (!EMAIL.test(email)) fieldErrors.email = 'Informe um e-mail válido.'
      if (password.length < MIN_PASSWORD_LENGTH) {
        fieldErrors.password = `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
      }
      if (Object.keys(fieldErrors).length > 0) raise(validationError(fieldErrors))

      if (scenario.rules?.signupConflict || findByEmail(store.getDb(), email)) {
        raise(apiError(409, 'conflict', 'Já existe uma conta com este e-mail.'))
      }

      const salt = randomSalt()
      const passwordHash = await hashPassword(password, salt)
      const auth = store.mutate((db, touch) => {
        // Reconfere dentro do mutate: duas requisições concorrentes não criam o mesmo e-mail
        if (findByEmail(db, email)) raise(apiError(409, 'conflict', 'Já existe uma conta com este e-mail.'))
        const id = newId()
        db.users[id] = { account: { id, email, name }, passwordHash, salt }
        db.carts[id] = { items: [] }
        db.profiles[id] = { accountId: id, displayName: name.split(/\s+/)[0] }
        db.favorites[id] = []
        db.wallets[id] = []
        touch('user', id)
        touch('profile', id)
        return openSession(db, id, touch)
      })
      return HttpResponse.json<AuthResponse>(auth, { status: 201 })
    }),
  ),

  http.post(
    `${API_URL}/auth/login`,
    withScenario('POST', '/auth/login', async ({ request }) => {
      const body = await readJson(request)
      const email = str(body.email)?.trim() ?? ''
      const password = str(body.password) ?? ''

      const fieldErrors: Record<string, string> = {}
      if (!email) fieldErrors.email = 'Informe seu e-mail.'
      if (!password) fieldErrors.password = 'Informe sua senha.'
      if (Object.keys(fieldErrors).length > 0) raise(validationError(fieldErrors))

      const user = findByEmail(store.getDb(), email)
      const valid = user !== undefined && (await hashPassword(password, user.salt)) === user.passwordHash
      if (!user || !valid) raise(apiError(401, 'unauthorized', 'E-mail ou senha inválidos.'))

      const auth = store.mutate((db, touch) => openSession(db, user.account.id, touch))
      return HttpResponse.json<AuthResponse>(auth)
    }),
  ),

  http.get(
    `${API_URL}/auth/session`,
    withScenario('GET', '/auth/session', ({ request }) => {
      const { token, accountId, expiresAt } = requireSession(request)
      const account = store.getDb().users[accountId].account
      return HttpResponse.json<Session>({ token, expiresAt, account })
    }),
  ),

  // Idempotente: token ausente, desconhecido ou já expirado também responde 204
  http.post(
    `${API_URL}/auth/logout`,
    withScenario('POST', '/auth/logout', ({ request }) => {
      const token = bearerToken(request)
      if (token && token in store.getDb().sessions) {
        store.mutate((db, touch) => {
          delete db.sessions[token]
          touch('session', token)
        })
      }
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
