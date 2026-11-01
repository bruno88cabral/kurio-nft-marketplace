import type { QueryClient } from '@tanstack/react-query'
import * as cartApi from '@/api/cart'
import { cartKeys } from '@/api/cart'
import { captureSession } from '@/auth/sessionGuard'
import type { Cart, CartItem, Id, NftEditionKind } from '@/contracts'
import type { AnonymousCartStore } from './anonymousCart'

export interface CartActions {
  /**
   * Soma `item.quantity` à linha. Visitante: local, limitado a `available`. Logado: `POST /cart/items`
   * (`available` é ignorado: o servidor decide e responde 409 acima do estoque). Rejeita com o erro da API.
   */
  add: (item: CartItem, opts: { available: number }) => Promise<void>
  /** Define a quantidade da linha. Visitante: local (menor que 1 remove). Logado: `PATCH` (o servidor valida). */
  setQuantity: (nftId: Id, edition: NftEditionKind, quantity: number) => Promise<void>
  remove: (nftId: Id, edition: NftEditionKind) => Promise<void>
  /** Só logado (o visitante não tem cupom nem cotação): para ele resolve sem fazer nada. */
  applyCoupon: (code: string) => Promise<void>
  removeCoupon: () => Promise<void>
}

/** As chamadas à API que as ações do logado usam (injetáveis nos testes). */
export interface CartApi {
  addCartItem: typeof cartApi.addCartItem
  updateCartItem: typeof cartApi.updateCartItem
  removeCartItem: typeof cartApi.removeCartItem
  applyCoupon: typeof cartApi.applyCoupon
  removeCoupon: typeof cartApi.removeCoupon
}

export interface CartActionsDeps {
  queryClient: QueryClient
  /** Conta logada; `undefined` = visitante. */
  accountId: Id | undefined
  store: AnonymousCartStore
  /** Padrão: a API real. */
  api?: CartApi
  /** Padrão: `captureSession()` do ciclo de vida. */
  capture?: () => () => boolean
}

const noop = () => Promise.resolve()

/** Ações do visitante: locais (`kurio:cart`), sem cupom. */
export function guestCartActions(store: AnonymousCartStore): CartActions {
  return {
    add: (item, { available }) => Promise.resolve(store.add(item, available)),
    setQuantity: (nftId, edition, quantity) => Promise.resolve(store.setQuantity(nftId, edition, quantity)),
    remove: (nftId, edition) => Promise.resolve(store.remove(nftId, edition)),
    applyCoupon: noop,
    removeCoupon: noop,
  }
}

/**
 * Ações da conta, sem otimismo: a resposta (`Cart`) vai para `['cart', accountId]` só se a sessão for a mesma
 * de quando a ação saiu (login, logout ou expiração no meio do caminho não recriam a chave da conta anterior).
 * Os erros da API são relançados.
 */
export function accountCartActions(deps: CartActionsDeps & { accountId: Id }): CartActions {
  const { queryClient, accountId, api = cartApi, capture = captureSession } = deps
  const run = async (call: () => Promise<Cart>): Promise<void> => {
    const sameSession = capture()
    const cart = await call()
    if (sameSession()) queryClient.setQueryData(cartKeys.detail(accountId), cart)
  }
  return {
    add: (item) => run(() => api.addCartItem(item)),
    setQuantity: (nftId, edition, quantity) => run(() => api.updateCartItem(nftId, edition, { quantity })),
    remove: (nftId, edition) => run(() => api.removeCartItem(nftId, edition)),
    applyCoupon: (code) => run(() => api.applyCoupon({ code })),
    removeCoupon: () => run(() => api.removeCoupon()),
  }
}

/** Visitante ou conta, conforme haja `accountId`. */
export function createCartActions(deps: CartActionsDeps): CartActions {
  return deps.accountId === undefined ? guestCartActions(deps.store) : accountCartActions({ ...deps, accountId: deps.accountId })
}
