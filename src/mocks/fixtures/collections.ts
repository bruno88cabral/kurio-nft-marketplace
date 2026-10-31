import type { EthAmount } from '@/contracts'
import { parseEth } from '@/lib/eth'

export const COLLECTIONS = [
  'Aurora Drift',
  'Pixel Reefs',
  'Neon Atlas',
  'Obsidian Garden',
  'Paper Comets',
] as const

export type CollectionName = (typeof COLLECTIONS)[number]

export const COLLECTION_CREATORS: Record<CollectionName, string> = {
  'Aurora Drift': 'Helena Voss',
  'Pixel Reefs': 'Tomo Kitano',
  'Neon Atlas': 'Maya Okafor',
  'Obsidian Garden': 'Luca Ferraro',
  'Paper Comets': 'Inês Duarte',
}

export interface Coupon {
  code: string
  /** Desconto percentual sobre o subtotal. */
  percentOff: number
  expired: boolean
}

/** Cupons fixos; qualquer outro código é `invalid`. */
export const COUPONS: Record<string, Coupon> = {
  KURIO10: { code: 'KURIO10', percentOff: 10, expired: false },
  EXPIRED5: { code: 'EXPIRED5', percentOff: 5, expired: true },
}

/** Taxa de rede fixa por pedido. */
export const NETWORK_FEE: EthAmount = parseEth('0.002')
