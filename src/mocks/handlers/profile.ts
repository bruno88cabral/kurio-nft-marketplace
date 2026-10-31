import { http, HttpResponse } from 'msw'
import { API_URL } from '@/app/env'
import type { Id, Profile } from '@/contracts'
import { hashPassword } from '../db/password'
import { store } from '../runtime'
import { MIN_PASSWORD_LENGTH } from './auth'
import { readJson, str, validationError, raise } from './errors'
import { requireSession } from './session'
import { withScenario } from './withScenario'

export const MAX_DISPLAY_NAME = 60
/** Limite do data URL (caracteres) do avatar: ~150 KB de imagem em base64. */
export const MAX_AVATAR_LENGTH = 200_000
const AVATAR = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/

function toProfile(accountId: Id): Profile {
  const db = store.getDb()
  return { ...db.profiles[accountId], wallets: db.wallets[accountId] ?? [] }
}

export const profileHandlers = [
  http.get(
    `${API_URL}/profile`,
    withScenario('GET', '/profile', ({ request }) => {
      const { accountId } = requireSession(request)
      return HttpResponse.json<Profile>(toProfile(accountId))
    }),
  ),

  http.patch(
    `${API_URL}/profile`,
    withScenario('PATCH', '/profile', async ({ request }) => {
      const { accountId } = requireSession(request)
      const body = await readJson(request)
      const fieldErrors: Record<string, string> = {}

      let displayName: string | undefined
      if (body.displayName !== undefined) {
        displayName = str(body.displayName)?.trim()
        if (!displayName) fieldErrors.displayName = 'Informe um nome.'
        else if (displayName.length > MAX_DISPLAY_NAME) {
          fieldErrors.displayName = `Use até ${MAX_DISPLAY_NAME} caracteres.`
        }
      }

      // `avatarUrl: ''` remove o avatar
      let avatarUrl: string | undefined
      if (body.avatarUrl !== undefined) {
        avatarUrl = str(body.avatarUrl)
        if (avatarUrl === undefined) fieldErrors.avatarUrl = 'Avatar inválido.'
        else if (avatarUrl !== '' && !AVATAR.test(avatarUrl)) {
          fieldErrors.avatarUrl = 'Envie uma imagem PNG, JPEG, WebP ou GIF.'
        } else if (avatarUrl.length > MAX_AVATAR_LENGTH) {
          fieldErrors.avatarUrl = 'A imagem é grande demais.'
        }
      }
      if (Object.keys(fieldErrors).length > 0) raise(validationError(fieldErrors))

      store.mutate((db, touch) => {
        const profile = db.profiles[accountId]
        if (displayName !== undefined) profile.displayName = displayName
        if (avatarUrl !== undefined) {
          if (avatarUrl === '') delete profile.avatarUrl
          else profile.avatarUrl = avatarUrl
        }
        touch('profile', accountId)
      })
      return HttpResponse.json<Profile>(toProfile(accountId))
    }),
  ),

  // Rota do contrato: `PUT /profile/password` (`ChangePasswordRequest`), resposta 204
  http.put(
    `${API_URL}/profile/password`,
    withScenario('PUT', '/profile/password', async ({ request }) => {
      const { accountId } = requireSession(request)
      const body = await readJson(request)
      const currentPassword = str(body.currentPassword) ?? ''
      const newPassword = str(body.newPassword) ?? ''
      const user = store.getDb().users[accountId]

      const fieldErrors: Record<string, string> = {}
      if (!currentPassword) fieldErrors.currentPassword = 'Informe a senha atual.'
      else if ((await hashPassword(currentPassword, user.salt)) !== user.passwordHash) {
        fieldErrors.currentPassword = 'Senha atual incorreta.'
      }
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        fieldErrors.newPassword = `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
      } else if (newPassword === currentPassword) {
        fieldErrors.newPassword = 'A nova senha deve ser diferente da atual.'
      }
      if (Object.keys(fieldErrors).length > 0) raise(validationError(fieldErrors))

      const salt = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('')
      const passwordHash = await hashPassword(newPassword, salt)
      store.mutate((db, touch) => {
        db.users[accountId].salt = salt
        db.users[accountId].passwordHash = passwordHash
        touch('user', accountId)
      })
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
