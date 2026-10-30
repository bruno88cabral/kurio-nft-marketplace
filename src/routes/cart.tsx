import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/cart')({
  head: () => ({ meta: [{ title: 'Carrinho · Kurio' }] }),
  component: CartPage,
})

function CartPage() {
  return <h1>Carrinho</h1>
}
