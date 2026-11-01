import { createFileRoute } from '@tanstack/react-router'
import { CartPage } from '@/features/cart/CartPage'

export const Route = createFileRoute('/cart')({
  head: () => ({ meta: [{ title: 'Carrinho · Kurio' }] }),
  component: CartPage,
})
