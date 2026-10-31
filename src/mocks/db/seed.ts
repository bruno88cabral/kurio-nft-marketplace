import type { Favorite, Wallet } from '@/contracts'
import { NFTS } from '../fixtures/nfts'
import { SEED_FAVORITES, USERS } from '../fixtures/users'
import type { Scenario } from '../scenarios'
import { nftId, USER_BRUNO, walletSeedId } from './ids'
import type { MockDb } from './schema'

const SEED_FAVORITED_AT = '2026-09-20T09:00:00.000Z'

/** Estado inicial do mock. Pura e determinística: sem `Date.now()` e sem `randomUUID()`. */
export function seed(scenario: Pick<Scenario, 'rules'>): MockDb {
  const db: MockDb = {
    users: {},
    sessions: {},
    nfts: {},
    favorites: {},
    carts: {},
    quotes: {},
    orders: {},
    idempotency: {},
    wallets: {},
    profiles: {},
    versions: {},
  }

  if (!scenario.rules?.emptyCatalog) {
    for (const nft of NFTS) db.nfts[nft.id] = structuredClone(nft)
  }

  for (const user of USERS) {
    const { id } = user.account
    db.users[id] = { account: { ...user.account }, passwordHash: user.passwordHash, salt: user.salt }
    db.carts[id] = { items: [] }
    db.profiles[id] = { accountId: id, displayName: user.displayName }
    db.favorites[id] = (SEED_FAVORITES[id] ?? [])
      .map(nftId)
      .filter((favId) => favId in db.nfts)
      .map((favId): Favorite => ({ nftId: favId, createdAt: SEED_FAVORITED_AT }))

    const wallets: Wallet[] = [
      {
        id: walletSeedId(id, 1),
        address:
          id === USER_BRUNO
            ? '0xb2c4e8f0a6d2917b3c5e7f9a1d3b5c7e9f1a3b5c'
            : '0xa1c4e8f0a6d2917b3c5e7f9a1d3b5c7e9f1a3b5c',
        network: 'ethereum',
        role: 'primary',
        label: 'Carteira principal',
      },
    ]
    if (id === USER_BRUNO) {
      wallets.push({
        id: walletSeedId(id, 2),
        address: '0x4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f',
        network: 'polygon',
        role: 'secondary',
        label: 'Polygon',
      })
    }
    db.wallets[id] = wallets
  }

  return db
}
