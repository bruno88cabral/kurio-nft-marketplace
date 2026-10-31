import type { Account, Cart, Favorite, Id, IsoDateTime, Nft, Order, Profile, Quote, Wallet } from '@/contracts'

export type StoredQuote = Quote & { accountId: Id }
export type StoredOrder = Order & { accountId: Id }

/** Estado único do mock. Serializável em JSON; os tipos de payload vêm de `@/contracts`. */
export interface MockDb {
  users: Record<Id, { account: Account; passwordHash: string; salt: string }>
  sessions: Record<string /* token */, { accountId: Id; expiresAt: IsoDateTime }>
  nfts: Record<Id, Nft>
  favorites: Record<Id /* accountId */, Favorite[]>
  carts: Record<Id /* accountId */, Cart>
  quotes: Record<Id, StoredQuote>
  orders: Record<Id, StoredOrder>
  idempotency: Record<string, { fingerprint: string; orderId: Id }>
  wallets: Record<Id /* accountId */, Wallet[]>
  profiles: Record<Id /* accountId */, Omit<Profile, 'wallets'>>
  versions: Record<string /* `${ResourceType}:${id}` */, number>
}

/** Tipo de recurso no formato `versions` (`nft:nft-001`, `order:<uuid>`). */
export type ResourceType =
  | 'user'
  | 'session'
  | 'nft'
  | 'favorite'
  | 'cart'
  | 'quote'
  | 'order'
  | 'idempotency'
  | 'wallet'
  | 'profile'

export function resourceKey(type: ResourceType, id: Id): string {
  return `${type}:${id}`
}

export const DB_COLLECTIONS = [
  'users',
  'sessions',
  'nfts',
  'favorites',
  'carts',
  'quotes',
  'orders',
  'idempotency',
  'wallets',
  'profiles',
  'versions',
] as const satisfies ReadonlyArray<keyof MockDb>
