import { http, HttpResponse } from 'msw'
import { API_URL } from '@/app/env'
import type { Favorite } from '@/contracts'
import { store } from '../runtime'
import { notFound, raise } from './errors'
import { requireSession } from './session'
import { withScenario } from './withScenario'

export const favoriteHandlers = [
  http.get(
    `${API_URL}/favorites`,
    withScenario('GET', '/favorites', ({ request }) => {
      const { accountId } = requireSession(request)
      return HttpResponse.json<Favorite[]>(store.getDb().favorites[accountId] ?? [])
    }),
  ),

  // Idempotente: favoritar de novo devolve o favorito existente e não versiona nada
  http.put(
    `${API_URL}/favorites/:nftId`,
    withScenario('PUT', '/favorites/:nftId', ({ request, params }) => {
      const { accountId } = requireSession(request)
      const nftId = String(params.nftId)
      if (!(nftId in store.getDb().nfts)) raise(notFound('NFT não encontrado.'))

      const existing = store.getDb().favorites[accountId]?.find((f) => f.nftId === nftId)
      if (existing) return HttpResponse.json<Favorite>(existing)

      const favorite: Favorite = { nftId, createdAt: new Date().toISOString() }
      store.mutate((db, touch) => {
        ;(db.favorites[accountId] ??= []).push(favorite)
        touch('favorite', accountId)
      })
      return HttpResponse.json<Favorite>(favorite)
    }),
  ),

  // Idempotente: remover quem não é favorito também responde 204
  http.delete(
    `${API_URL}/favorites/:nftId`,
    withScenario('DELETE', '/favorites/:nftId', ({ request, params }) => {
      const { accountId } = requireSession(request)
      const nftId = String(params.nftId)
      if (store.getDb().favorites[accountId]?.some((f) => f.nftId === nftId)) {
        store.mutate((db, touch) => {
          db.favorites[accountId] = db.favorites[accountId].filter((f) => f.nftId !== nftId)
          touch('favorite', accountId)
        })
      }
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
