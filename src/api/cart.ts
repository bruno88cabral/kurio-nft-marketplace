import { queryOptions } from '@tanstack/react-query'
import type {
  AddCartItemRequest,
  ApplyCouponRequest,
  Cart,
  Id,
  MergeCartRequest,
  NftEditionKind,
  UpdateCartItemRequest,
} from '@/contracts'
import { apiClient } from './client'

/**
 * Isolada por conta (a raiz `cart` é privada: o ciclo de vida reseta no login, no logout e na expiração).
 * A cotação mora sob a mesma raiz de propósito: sai junto no reset privado.
 */
export const cartKeys = {
  all: ['cart'] as const,
  detail: (accountId: Id) => ['cart', accountId] as const,
  quote: (accountId: Id, fingerprint: string) => ['cart', accountId, 'quote', fingerprint] as const,
}

/** `GET /cart` da conta logada. O `accountId` só entra na chave (a API usa o Bearer). */
export function cartQuery(accountId: Id) {
  return queryOptions({
    queryKey: cartKeys.detail(accountId),
    queryFn: async ({ signal }) => (await apiClient.get<Cart>('/cart', { signal })).data,
  })
}

// `edition` tem barra (`1/10`): vai codificada no segmento do path (o handler faz `decodeURIComponent`)
const itemPath = (nftId: Id, edition: NftEditionKind) =>
  `/cart/items/${encodeURIComponent(nftId)}/${encodeURIComponent(edition)}`

// Toda mutation devolve o `Cart` inteiro; quem chama grava em `cartKeys.detail` (sem otimismo: o servidor decide o estoque).

/** `POST /cart/items` (201). Soma à linha existente; 409 acima do estoque, 404 NFT ou edição inexistente, 422 quantidade. */
export const addCartItem = (body: AddCartItemRequest) => apiClient.post<Cart>('/cart/items', body).then((r) => r.data)

/** `PATCH /cart/items/:nftId/:edition`. Define a quantidade (não soma); 404 se a linha não existe, 409 acima do estoque. */
export const updateCartItem = (nftId: Id, edition: NftEditionKind, body: UpdateCartItemRequest) =>
  apiClient.patch<Cart>(itemPath(nftId, edition), body).then((r) => r.data)

/** `DELETE /cart/items/:nftId/:edition`. Idempotente (remover quem não está no carrinho devolve o carrinho). */
export const removeCartItem = (nftId: Id, edition: NftEditionKind) =>
  apiClient.delete<Cart>(itemPath(nftId, edition)).then((r) => r.data)

/** `POST /cart/merge`. Soma o carrinho do visitante ao da conta, limitado ao estoque; linhas inválidas são descartadas. */
export const mergeCart = (body: MergeCartRequest) => apiClient.post<Cart>('/cart/merge', body).then((r) => r.data)

/** `PUT /cart/coupon`. Guarda o código normalizado; `applied`/`invalid`/`expired` só aparece na cotação. 422 código vazio. */
export const applyCoupon = (body: ApplyCouponRequest) => apiClient.put<Cart>('/cart/coupon', body).then((r) => r.data)

/** `DELETE /cart/coupon`. */
export const removeCoupon = () => apiClient.delete<Cart>('/cart/coupon').then((r) => r.data)

/**
 * Identidade do carrinho para a chave da cotação: linhas ordenadas por `nftId:edition`, com a quantidade,
 * e o cupom. Mesma composição em outra ordem dá a mesma chave; mudar quantidade, linha ou cupom, outra.
 * Os separadores (`|`, `x`, `#`) não aparecem em ids nem em edições (`1/10`, `open`).
 */
export function cartFingerprint(cart: Cart): string {
  const lines = cart.items.map((i) => `${i.nftId}:${i.edition}x${i.quantity}`).sort()
  return `${lines.join('|')}#${cart.couponCode ?? ''}`
}
