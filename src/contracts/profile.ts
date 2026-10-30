import type { Id } from './common'
import type { Wallet } from './wallet'

// TODO M4: campos do formulário de perfil
export interface Profile {
  accountId: Id
  displayName: string
  avatarUrl?: string
  wallets: Wallet[]
}
