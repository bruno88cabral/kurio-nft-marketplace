import { hashKey, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'

/**
 * `true` enquanto a query está invalidada (`invalidateQueries`) e a resposta nova não chegou. O resultado do
 * `useQuery` não expõe isso: refazer a MESMA chave não é `isPlaceholderData`, e `isStale` também liga sozinho
 * com o tempo. O carrinho e o checkout somam isto ao "recotando" para a cotação invalidada por um `nft.updated`
 * aparecer como desatualizada até a nova chegar (MYK-1091).
 */
export function useQueryInvalidated(queryKey: QueryKey): boolean {
  const cache = useQueryClient().getQueryCache()
  const hash = hashKey(queryKey)
  const subscribe = useCallback((onChange: () => void) => cache.subscribe(onChange), [cache])
  const get = () => cache.get(hash)?.state.isInvalidated ?? false
  return useSyncExternalStore(subscribe, get, get)
}
