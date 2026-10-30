import type { Id } from './common'

export type Network = 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' // TODO M3: confirmar redes suportadas

export type WalletRole = 'primary' | 'secondary'

export interface Wallet {
  id: Id
  address: string
  network: Network
  role: WalletRole
}
