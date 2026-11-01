import { queryOptions } from '@tanstack/react-query'
import type { Cart, Id, Quote } from '@/contracts'
import { cartFingerprint, cartKeys } from './cart'
import { apiClient } from './client'

/** Margem antes do vencimento (`Quote.expiresAt`, 5 min no mock) para recotar sem o usuário ver a cotação vencida. */
export const QUOTE_REFRESH_MARGIN_MS = 60_000
/** Piso do intervalo: uma cotação já perto de vencer não vira um laço de requests. */
export const QUOTE_MIN_REFETCH_MS = 5_000
/** Fresca por 1 min (bem abaixo da validade de 5 min): reabrir o checkout dentro disso reaproveita a cotação. */
export const QUOTE_STALE_TIME_MS = 60_000

/** Quanto esperar até recotar: `expiresAt` menos a margem, nunca abaixo do piso. `false` se a data é inválida. */
export function quoteRefetchDelay(expiresAt: string, now: number): number | false {
  const expires = Date.parse(expiresAt)
  if (Number.isNaN(expires)) return false
  return Math.max(expires - now - QUOTE_REFRESH_MARGIN_MS, QUOTE_MIN_REFETCH_MS)
}

/**
 * `POST /quotes` (sem corpo; a API cota o carrinho da conta). A chave carrega o fingerprint do carrinho
 * recebido: carrinho diferente, cotação diferente. Só roda com itens (carrinho vazio daria 422).
 * O cliente nunca soma valores: tudo que a tela mostra vem do `Quote`.
 */
export function quoteQuery(accountId: Id, cart: Cart) {
  return queryOptions({
    queryKey: cartKeys.quote(accountId, cartFingerprint(cart)),
    queryFn: async ({ signal }) => (await apiClient.post<Quote>('/quotes', undefined, { signal })).data,
    enabled: cart.items.length > 0,
    staleTime: QUOTE_STALE_TIME_MS,
    // Reavaliado a cada resposta: recota antes de `expiresAt` e para quando não há cotação
    refetchInterval: (query) => {
      const quote = query.state.data
      return quote ? quoteRefetchDelay(quote.expiresAt, Date.now()) : false
    },
  })
}
