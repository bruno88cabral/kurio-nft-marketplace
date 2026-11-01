import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import { favoriteKeys } from '@/api/favorites'
import type { SessionCheck } from '@/auth/sessionLifecycle'
import { isUnauthorized, type Favorite, type Id, type IsoDateTime } from '@/contracts'

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
  return !isUnauthorized(error)
}

export const favoriteMutationKey = (nftId: Id) => ['favorite', nftId] as const

export interface FavoriteMutationDeps {
  queryClient: QueryClient
  accountId: Id
  nftId: Id
  /** `PUT` (on) ou `DELETE` (off) no servidor. */
  request: (nftId: Id, on: boolean) => Promise<void>
  now: () => IsoDateTime
  /** Chamado uma vez por falha, depois do rollback (o hook mostra o toast). */
  onFailure: (error: Error) => void
  /** `sessionLifecycle.captureSession`: o clique captura a sessão em que foi feito. */
  captureSession: () => SessionCheck
}

interface FavoriteMutationContext {
  snapshot: Favorite[] | undefined
  sameSession: SessionCheck
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
 * - Sessão: se houve logout/troca de conta antes da resposta, nem o otimista, nem o rollback, nem o
 *   aviso, nem a invalidação rodam (recriariam `['favorites', <conta anterior>]` na sessão seguinte).
 */
export function favoriteMutationOptions({
  queryClient,
  accountId,
  nftId,
  request,
  now,
  onFailure,
  captureSession,
}: FavoriteMutationDeps) {
  const queryKey = favoriteKeys.list(accountId)
  const mutationKey = favoriteMutationKey(nftId)
  return mutationOptions<void, Error, boolean, FavoriteMutationContext>({
    mutationKey,
    scope: { id: `favorite:${accountId}:${nftId}` },
    mutationFn: (on) => request(nftId, on),
    onMutate: async (on) => {
      const sameSession = captureSession()
      await queryClient.cancelQueries({ queryKey })
      if (!sameSession()) return { snapshot: undefined, sameSession }
      const snapshot = queryClient.getQueryData<Favorite[]>(queryKey)
      queryClient.setQueryData<Favorite[]>(queryKey, (list) => applyFavoriteToggle(list, nftId, on, now()))
      return { snapshot, sameSession }
    },
    onError: (error, on, context) => {
      if (context && !context.sameSession()) return
      if (context) {
        // `setQueryData(key, undefined)` não faz nada: sem snapshot, desfaz o toggle
        queryClient.setQueryData<Favorite[]>(
          queryKey,
          (list) => context.snapshot ?? applyFavoriteToggle(list, nftId, !on, now()),
        )
      }
      onFailure(error)
    },
    onSettled: async (_data, _error, _on, context) => {
      if (context && !context.sameSession()) return
      if (queryClient.isMutating({ mutationKey }) <= 1) await queryClient.invalidateQueries({ queryKey })
    },
  })
}
