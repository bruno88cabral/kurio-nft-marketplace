import { queryOptions } from '@tanstack/react-query'
import type { Favorite, Id } from '@/contracts'
import { apiClient } from './client'

/** Isolada por conta: trocar de usuário nunca reaproveita o cache do anterior. */
export const favoriteKeys = {
  all: ['favorites'] as const,
  list: (accountId: Id) => ['favorites', accountId] as const,
}

export function favoritesQuery(accountId: Id) {
  return queryOptions({
    queryKey: favoriteKeys.list(accountId),
    queryFn: async ({ signal }) => (await apiClient.get<Favorite[]>('/favorites', { signal })).data,
  })
}

/** Idempotente. O hook otimista com rollback é da tela de Detalhe. */
export async function addFavorite(nftId: Id): Promise<void> {
  await apiClient.put(`/favorites/${encodeURIComponent(nftId)}`)
}

/** Idempotente. */
export async function removeFavorite(nftId: Id): Promise<void> {
  await apiClient.delete(`/favorites/${encodeURIComponent(nftId)}`)
}
