import type { Id } from '@/contracts'

/** IDs determinísticos do seed. Depois do seed, os handlers usam `newId()`. */
export const USER_ANA: Id = 'user-ana'
export const USER_BRUNO: Id = 'user-bruno'

export function nftId(n: number): Id {
  return `nft-${String(n).padStart(3, '0')}`
}

export function walletSeedId(userId: Id, n: number): Id {
  return `wallet-${userId.replace(/^user-/, '')}-${n}`
}

export function newId(): Id {
  return crypto.randomUUID()
}
