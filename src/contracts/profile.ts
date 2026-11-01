import type { Id } from './common'
import type { Wallet } from './wallet'

/** `GET /profile`. */
export interface Profile {
  accountId: Id
  displayName: string
  avatarUrl?: string
  wallets: Wallet[]
}

/** `PATCH /profile`, resposta `Profile`. */
export interface UpdateProfileRequest {
  displayName?: string
  avatarUrl?: string
}

/** `PUT /profile/password`, resposta 204. */
export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}
