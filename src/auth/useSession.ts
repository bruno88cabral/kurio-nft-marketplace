import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { Account, Session } from '@/contracts'
import { getToken } from './sessionStorage'

export const SESSION_QUERY_KEY = ['session'] as const

export function sessionQuery() {
  return queryOptions({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async ({ signal }) => (await apiClient.get<Session>('/auth/session', { signal })).data,
    enabled: getToken() !== null,
    // 401 é sessão morta: o ciclo de vida (`notifyExpired`) limpa e reseta; repetir só atrasa o "deslogado"
    retry: false,
  })
}

export interface UseSession {
  account: Account | undefined
  isAuthenticated: boolean
  /** `true` enquanto o token existe e a sessão ainda está sendo confirmada. */
  isPending: boolean
}

export function useSession(): UseSession {
  const { data, isPending, fetchStatus } = useQuery(sessionQuery())
  // Sem token válido o dado em cache não vale; o reset do ciclo de vida re-renderiza aqui
  const session = getToken() === null ? undefined : data
  return {
    account: session?.account,
    isAuthenticated: session !== undefined,
    isPending: isPending && fetchStatus !== 'idle',
  }
}
