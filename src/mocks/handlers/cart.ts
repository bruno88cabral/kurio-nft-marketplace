import { http, HttpResponse } from 'msw'
import { API_URL } from '@/app/env'
import type { AddCartItemRequest, Cart, MergeCartRequest, NftEditionKind } from '@/contracts'
import { addItem, applyCoupon, getCart, mergeCart, removeCoupon, removeItem, updateItem } from '../db/cart'
import { store } from '../runtime'
import { domainGuard } from './domain'
import { raise, readJson, str, validationError } from './errors'
import { requireSession } from './session'
import { withScenario } from './withScenario'

const EDITIONS: readonly NftEditionKind[] = ['1/1', '1/10', '1/50', 'open']

function edition(raw: unknown): NftEditionKind {
  const found = EDITIONS.find((e) => e === raw)
  if (!found) raise(validationError({ edition: `Edição inválida. Use: ${EDITIONS.join(', ')}.` }))
  return found
}

function cartLine(raw: unknown): AddCartItemRequest {
  const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const nftId = str(body.nftId)
  if (!nftId) raise(validationError({ nftId: 'Informe o NFT.' }))
  // `quantity` é validada no domínio (inteiro >= 1)
  return { nftId, edition: edition(body.edition), quantity: body.quantity as number }
}

export const cartHandlers = [
  http.get(
    `${API_URL}/cart`,
    withScenario('GET', '/cart', ({ request }) => {
      const { accountId } = requireSession(request)
      return HttpResponse.json<Cart>(getCart(store.getDb(), accountId))
    }),
  ),

  http.post(
    `${API_URL}/cart/items`,
    withScenario('POST', '/cart/items', async ({ request }) => {
      const { accountId } = requireSession(request)
      const req = cartLine(await readJson(request))
      const cart = domainGuard(() => store.mutate((db, touch) => addItem(db, touch, accountId, req)))
      return HttpResponse.json<Cart>(cart, { status: 201 })
    }),
  ),

  http.patch(
    `${API_URL}/cart/items/:nftId/:edition`,
    withScenario('PATCH', '/cart/items/:nftId/:edition', async ({ request, params }) => {
      const { accountId } = requireSession(request)
      const kind = edition(decodeURIComponent(String(params.edition)))
      const body = await readJson(request)
      const cart = domainGuard(() =>
        store.mutate((db, touch) =>
          updateItem(db, touch, accountId, String(params.nftId), kind, { quantity: body.quantity as number }),
        ),
      )
      return HttpResponse.json<Cart>(cart)
    }),
  ),

  http.delete(
    `${API_URL}/cart/items/:nftId/:edition`,
    withScenario('DELETE', '/cart/items/:nftId/:edition', ({ request, params }) => {
      const { accountId } = requireSession(request)
      const kind = edition(decodeURIComponent(String(params.edition)))
      const cart = store.mutate((db, touch) => removeItem(db, touch, accountId, String(params.nftId), kind))
      return HttpResponse.json<Cart>(cart)
    }),
  ),

  http.post(
    `${API_URL}/cart/merge`,
    withScenario('POST', '/cart/merge', async ({ request }) => {
      const { accountId } = requireSession(request)
      const body = await readJson(request)
      if (!Array.isArray(body.items)) raise(validationError({ items: 'Informe a lista de itens.' }))
      const req: MergeCartRequest = { items: body.items.map(cartLine) }
      const cart = store.mutate((db, touch) => mergeCart(db, touch, accountId, req))
      return HttpResponse.json<Cart>(cart)
    }),
  ),

  http.put(
    `${API_URL}/cart/coupon`,
    withScenario('PUT', '/cart/coupon', async ({ request }) => {
      const { accountId } = requireSession(request)
      const body = await readJson(request)
      const cart = domainGuard(() =>
        store.mutate((db, touch) => applyCoupon(db, touch, accountId, str(body.code) ?? '')),
      )
      return HttpResponse.json<Cart>(cart)
    }),
  ),

  http.delete(
    `${API_URL}/cart/coupon`,
    withScenario('DELETE', '/cart/coupon', ({ request }) => {
      const { accountId } = requireSession(request)
      return HttpResponse.json<Cart>(store.mutate((db, touch) => removeCoupon(db, touch, accountId)))
    }),
  ),
]
