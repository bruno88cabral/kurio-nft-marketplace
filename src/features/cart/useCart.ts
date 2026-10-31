import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { cartQuery } from '@/api/cart'
import { useSession } from '@/auth/useSession'
import type { CartItem } from '@/contracts'
import { anonymousCart } from './anonymousCart'
import { createCartActions, type CartActions } from './cartActions'

export interface UseCart extends CartActions {
  items: readonly CartItem[]
  couponCode?: string
  /** Soma das quantidades das linhas (a única aritmética do cliente; valores em ETH só vêm da cotação). */
  totalQuantity: number
  isAuthenticated: boolean
  /** Sessão sendo confirmada ou primeira carga do carrinho da conta. O visitante nunca fica pendente. */
  isPending: boolean
  isError: boolean
  refetch: () => Promise<unknown>
}

const NO_ITEMS: readonly CartItem[] = []

const sumQuantity = (items: readonly CartItem[]) => items.reduce((total, item) => total + item.quantity, 0)

/**
 * Carrinho para as telas, com a mesma forma para visitante (`localStorage`, `kurio:cart`) e logado
 * (`GET /cart`). O hook só compõe: leitura (store local ou `useQuery`) e `createCartActions` (`cartActions.ts`,
 * onde estão a escolha visitante/logado e a gravação em `['cart', accountId]` com guarda de sessão).
 * Os erros das ações do logado são relançados: quem chama decide toast ou erro de campo; trate o `catch`.
 */
export function useCart(): UseCart {
  const queryClient = useQueryClient()
  const session = useSession()
  const accountId = session.account?.id
  const guest = useSyncExternalStore(anonymousCart.subscribe, anonymousCart.getSnapshot, () => NO_ITEMS)
  const cartRead = useQuery({ ...cartQuery(accountId ?? ''), enabled: accountId !== undefined })
  const actions = createCartActions({ queryClient, accountId, store: anonymousCart })

  if (accountId === undefined) {
    return {
      ...actions,
      isAuthenticated: false,
      items: guest,
      totalQuantity: sumQuantity(guest),
      // Token guardado e sessão ainda sendo confirmada: não mostrar o carrinho local como se fosse o da conta
      isPending: session.isPending,
      isError: false,
      refetch: () => Promise.resolve(),
    }
  }

  const items = cartRead.data?.items ?? NO_ITEMS
  return {
    ...actions,
    isAuthenticated: true,
    items,
    couponCode: cartRead.data?.couponCode,
    totalQuantity: sumQuantity(items),
    isPending: cartRead.isPending,
    isError: cartRead.isError,
    refetch: () => cartRead.refetch(),
  }
}
