import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import { favoriteKeys } from '@/api/favorites'
import { ApiError, type Favorite, type Id, type IsoDateTime } from '@/contracts'

/** `true` se o NFT está na lista de favoritos (lista ausente = nenhum). */
export function isFavorited(list: readonly Favorite[] | undefined, nftId: Id): boolean {
  return list?.some((f) => f.nftId === nftId) ?? false
}

/**
 * Lista com o NFT ligado (`on`) ou desligado. Idempotente, como o `PUT`/`DELETE` do servidor:
 * ligar o que já está ligado (ou desligar o que não está) devolve a MESMA lista.
 */
export function applyFavoriteToggle(
  list: readonly Favorite[] | undefined,
  nftId: Id,
  on: boolean,
  now: IsoDateTime,
): Favorite[] {
  const current = list ?? []
  const has = isFavorited(current, nftId)
  if (on === has) return list === undefined ? [] : (current as Favorite[])
  return on ? [...current, { nftId, createdAt: now }] : current.filter((f) => f.nftId !== nftId)
}

/**
 * A falha merece o toast genérico? 401 (`unauthorized`) não: a sessão expirou e o ciclo de vida
 * (`notifyExpired`) já mostra "Sua sessão expirou", então seriam dois toasts para o mesmo problema.
 */
export function shouldToastFavoriteFailure(error: Error): boolean {
  return !(error instanceof ApiError && error.code === 'unauthorized')
}

export const favoriteMutationKey =(nftId: Id) => ['favorite', nftId] as const

export interface FavoriteMutationDeps {
  queryClient: QueryClient
  accountId: Id
  nftId: Id
  /** `PUT` (on) ou `DELETE` (off) no servidor. */
  request: (nftId: Id, on: boolean) => Promise<void>
  now: () => IsoDateTime
  /** Chamado uma vez por falha, depois do rollback (o hook mostra o toast). */
  onFailure: (error: Error) => void
}

interface FavoriteMutationContext {
  snapshot: Favorite[] | undefined
}

/**
 * Atualização otimista com rollback (a única do M2). As variáveis são o estado desejado
 * (`true` = favoritar). Fica fora do hook para ser testada com um `QueryClient` real em memória.
 *
 * - `onMutate`: cancela refetch em voo da lista da conta, guarda o snapshot e aplica o otimista.
 * - `onError`: restaura o snapshot e avisa.
 * - `onSettled`: invalida a lista para reconciliar com o servidor; com cliques em sequência no
 *   mesmo NFT, só o último a terminar invalida (o refetch não sobrescreve um otimista em voo).
 * - `scope`: as requests do mesmo NFT saem em série, então o servidor termina no último clique.
 */
export function favoriteMutationOptions({ queryClient, accountId, nftId, request, now, onFailure }: FavoriteMutationDeps) {
  const queryKey = favoriteKeys.list(accountId)
  const mutationKey = favoriteMutationKey(nftId)
  return mutationOptions<void, Error, boolean, FavoriteMutationContext>({
    mutationKey,
    scope: { id: `favorite:${accountId}:${nftId}` },
    mutationFn: (on) => request(nftId, on),
    onMutate: async (on) => {
      await queryClient.cancelQueries({ queryKey })
      const snapshot = queryClient.getQueryData<Favorite[]>(queryKey)
      queryClient.setQueryData<Favorite[]>(queryKey, (list) => applyFavoriteToggle(list, nftId, on, now()))
      return { snapshot }
    },
    onError: (error, on, context) => {
      if (context) {
        // `setQueryData(key, undefined)` não faz nada: sem snapshot, desfaz o toggle
        queryClient.setQueryData<Favorite[]>(
          queryKey,
          (list) => context.snapshot ?? applyFavoriteToggle(list, nftId, !on, now()),
        )
      }
      onFailure(error)
    },
    onSettled: async () => {
      if (queryClient.isMutating({ mutationKey }) <= 1) await queryClient.invalidateQueries({ queryKey })
    },
  })
}
