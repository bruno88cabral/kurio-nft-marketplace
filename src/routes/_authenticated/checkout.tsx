import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/checkout')({
  head: () => ({ meta: [{ title: 'Pagamento · Kurio' }] }),
  component: CheckoutPage,
})

function CheckoutPage() {
  return <h1>Pagamento</h1>
}
