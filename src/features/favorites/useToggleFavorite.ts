import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { addFavorite, favoriteKeys, favoritesQuery, removeFavorite } from '@/api/favorites'
import { useSession } from '@/auth/useSession'
import type { Favorite, Id } from '@/contracts'
import { favoriteMutationOptions, isFavorited } from './favoriteCache'

export const FAVORITE_FAILURE_MESSAGE = 'Não foi possível atualizar os favoritos.'

const request = (nftId: Id, on: boolean) => (on ? addFavorite(nftId) : removeFavorite(nftId))
const now = () => new Date().toISOString()

export interface ToggleFavorite {
  /** Estado exibido: sempre o do cache (`['favorites', accountId]`), já com o otimista. */
  favorited: boolean
  /** Visitante: vai para `/login?redirect=<aqui>`. Logado: inverte o estado atual do cache. */
  toggle: () => void
  /** Sessão ainda sendo confirmada (token existe): o botão espera. */
  pending: boolean
  /** Resultado do último clique concluído, para a região `aria-live` ("" até haver um). */
  announcement: string
}

/** Favoritar otimista com rollback; mesmo hook no Detalhe e no card mobile do Início. */
export function useToggleFavorite(nftId: Id): ToggleFavorite {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const href = useLocation({ select: (l) => l.href })
  const { account, isPending } = useSession()
  const accountId = account?.id ?? ''
  const [announcement, setAnnouncement] = useState('')

  const favorites = useQuery({ ...favoritesQuery(accountId), enabled: account !== undefined })
  const mutation = useMutation(
    favoriteMutationOptions({
      queryClient,
      accountId,
      nftId,
      request,
      now,
      onFailure: () => toast.error(FAVORITE_FAILURE_MESSAGE),
    }),
  )

  // Logado, mas a lista ainda não chegou: sem ela o clique não sabe o estado atual
  const pending = isPending || (account !== undefined && favorites.isPending)

  const toggle = () => {
    if (pending) return
    if (!account) {
      void navigate({ to: '/login', search: { redirect: href } })
      return
    }
    // Lê do cache no clique (não do render): cliques rápidos invertem sempre o estado mais recente
    const on = !isFavorited(queryClient.getQueryData<Favorite[]>(favoriteKeys.list(account.id)), nftId)
    mutation.mutate(on, {
      onSuccess: () => setAnnouncement(on ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.'),
      onError: () => setAnnouncement(''),
    })
  }

  return {
    favorited: account !== undefined && isFavorited(favorites.data, nftId),
    toggle,
    pending,
    announcement,
  }
}
