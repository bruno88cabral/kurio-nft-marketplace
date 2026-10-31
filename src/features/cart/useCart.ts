import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import {
  addCartItem,
  applyCoupon,
  cartKeys,
  cartQuery,
  removeCartItem,
  removeCoupon,
  updateCartItem,
} from '@/api/cart'
import { captureSession, isSameSession } from '@/auth/sessionGuard'
import { useSession } from '@/auth/useSession'
import type { Cart, CartItem, Id, NftEditionKind } from '@/contracts'
import { anonymousCart } from './anonymousCart'

export interface UseCart {
  items: readonly CartItem[]
  couponCode?: string
  /** Soma das quantidades das linhas (a única aritmética do cliente; valores em ETH só vêm da cotação). */
  totalQuantity: number
  isAuthenticated: boolean
  /** Sessão sendo confirmada ou primeira carga do carrinho da conta. O visitante nunca fica pendente. */
  isPending: boolean
  isError: boolean
  refetch: () => Promise<unknown>
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

const NO_ITEMS: readonly CartItem[] = []
const noop = () => Promise.resolve()

const sumQuantity = (items: readonly CartItem[]) => items.reduce((total, item) => total + item.quantity, 0)

/**
 * Carrinho para as telas, com a mesma forma para visitante (`localStorage`, `kurio:cart`) e logado
 * (`GET /cart`). Ações do logado são mutations com guarda de sessão e sem otimismo: a resposta (`Cart`) vai
 * para `['cart', accountId]` só se a sessão for a mesma de quando saiu. Os erros das ações são relançados
 * (`mutateAsync`): quem chama decide toast ou erro de campo; trate o `catch`.
 */
export function useCart(): UseCart {
  const queryClient = useQueryClient()
  const session = useSession()
  const accountId = session.account?.id
  const guest = useSyncExternalStore(anonymousCart.subscribe, anonymousCart.getSnapshot, () => NO_ITEMS)

  const cartRead = useQuery({ ...cartQuery(accountId ?? ''), enabled: accountId !== undefined })

  const store = (cart: Cart, _variables: unknown, sameSession: (() => boolean) | undefined) => {
    if (accountId !== undefined && isSameSession(sameSession)) queryClient.setQueryData(cartKeys.detail(accountId), cart)
  }

  const add = useMutation({
    mutationFn: addCartItem,
    onMutate: captureSession,
    onSuccess: store,
  })
  const setQuantity = useMutation({
    mutationFn: (v: { nftId: Id; edition: NftEditionKind; quantity: number }) =>
      updateCartItem(v.nftId, v.edition, { quantity: v.quantity }),
    onMutate: captureSession,
    onSuccess: store,
  })
  const remove = useMutation({
    mutationFn: (v: { nftId: Id; edition: NftEditionKind }) => removeCartItem(v.nftId, v.edition),
    onMutate: captureSession,
    onSuccess: store,
  })
  const coupon = useMutation({
    mutationFn: (code: string | null) => (code === null ? removeCoupon() : applyCoupon({ code })),
    onMutate: captureSession,
    onSuccess: store,
  })

  const authenticated = session.isAuthenticated

  if (!authenticated) {
    return {
      isAuthenticated: false,
      items: guest,
      totalQuantity: sumQuantity(guest),
      // Token guardado e sessão ainda sendo confirmada: não mostrar o carrinho local como se fosse o da conta
      isPending: session.isPending,
      isError: false,
      refetch: () => Promise.resolve(),
      add: (item, { available }) => Promise.resolve(anonymousCart.add(item, available)),
      setQuantity: (nftId, edition, quantity) => Promise.resolve(anonymousCart.setQuantity(nftId, edition, quantity)),
      remove: (nftId, edition) => Promise.resolve(anonymousCart.remove(nftId, edition)),
      applyCoupon: noop,
      removeCoupon: noop,
    }
  }

  const items = cartRead.data?.items ?? NO_ITEMS
  return {
    isAuthenticated: true,
    refetch: () => cartRead.refetch(),
    items,
    couponCode: cartRead.data?.couponCode,
    totalQuantity: sumQuantity(items),
    isPending: cartRead.isPending,
    isError: cartRead.isError,
    add: async (item) => void (await add.mutateAsync(item)),
    setQuantity: async (nftId, edition, quantity) => void (await setQuantity.mutateAsync({ nftId, edition, quantity })),
    remove: async (nftId, edition) => void (await remove.mutateAsync({ nftId, edition })),
    applyCoupon: async (code) => void (await coupon.mutateAsync(code)),
    removeCoupon: async () => void (await coupon.mutateAsync(null)),
  }
}
