import type { Id } from './common'

export type Network = 'ethereum' | 'polygon' | 'arbitrum' | 'optimism'

export type WalletRole = 'primary' | 'secondary'

/** `GET /wallets` (lista `Wallet[]`). */
export interface Wallet {
  id: Id
  address: string
  network: Network
  role: WalletRole
  label: string
}

/** `POST /wallets`, resposta `Wallet`. */
export interface CreateWalletRequest {
  address: string
  network: Network
  label?: string
}

/** `PATCH /wallets/:walletId`, resposta `Wallet`. `DELETE` no mesmo caminho desconecta. */
export interface UpdateWalletRequest {
  label?: string
  role?: WalletRole
}
