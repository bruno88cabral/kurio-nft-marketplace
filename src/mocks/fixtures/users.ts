import type { Account, Id } from '@/contracts'
import { USER_ANA, USER_BRUNO } from '../db/ids'

/** Senha fictícia dos dois usuários do mock (documentada no README/ARCHITECTURE). */
export const FIXTURE_PASSWORD = 'Kurio#2026'

export interface FixtureUser {
  account: Account
  displayName: string
  /** sha256(`${salt}:${FIXTURE_PASSWORD}`) em hex, pré-calculado: o seed é síncrono e `crypto.subtle` não. */
  salt: string
  passwordHash: string
}

export const USERS: readonly FixtureUser[] = [
  {
    account: { id: USER_ANA, email: 'ana@kurio.test', name: 'Ana Souza' },
    displayName: 'Ana',
    salt: 'a3f1c9d27b4e5608',
    passwordHash: '9f8b358d5b3290b9f70795a91a384ed039c14b28d53e0244953f8d487087c19c',
  },
  {
    account: { id: USER_BRUNO, email: 'bruno@kurio.test', name: 'Bruno Lima' },
    displayName: 'Bruno',
    salt: '5be0d18c94a7f263',
    passwordHash: '3bd5a74b95d0d7048253a665a5c20e9db1b34b074df1defe620535d0b4ea28ea',
  },
]

/** Favoritos iniciais por usuário (NFTs por número do seed). */
export const SEED_FAVORITES: Record<Id, number[]> = {
  [USER_ANA]: [2, 9],
  [USER_BRUNO]: [],
}
