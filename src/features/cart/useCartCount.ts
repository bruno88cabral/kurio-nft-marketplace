import { useCart } from './useCart'

/** Quantidade para o badge e o `aria-label` do carrinho (0 enquanto a sessão carrega: ícone sem número). */
export function useCartCount(): number {
  const { totalQuantity, isPending } = useCart()
  return isPending ? 0 : totalQuantity
}
