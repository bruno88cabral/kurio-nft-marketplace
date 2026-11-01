import type { useSession } from '@/auth/useSession'
import type { Account } from '@/contracts'

/** Contas iguais às fixtures do mock (`src/mocks/fixtures/users.ts`). */
export const ANA: Account = { id: 'user-ana', email: 'ana@kurio.test', name: 'Ana Souza' }
export const BRUNO: Account = { id: 'user-bruno', email: 'bruno@kurio.test', name: 'Bruno Lima' }

/** Retorno de `useSession` para a conta dada; `null` é visitante. */
export function sessionOf(account: Account | null): ReturnType<typeof useSession> {
  return account === null
    ? { account: undefined, isAuthenticated: false, isPending: false }
    : { account, isAuthenticated: true, isPending: false }
}
