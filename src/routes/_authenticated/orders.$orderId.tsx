import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/orders/$orderId')({
  head: () => ({ meta: [{ title: 'Pedido · Kurio' }] }),
  component: OrderPage,
})

function OrderPage() {
  const { orderId } = Route.useParams()
  return <h1>Confirmação do pedido {orderId}</h1>
}
