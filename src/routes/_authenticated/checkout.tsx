import { createFileRoute } from '@tanstack/react-router'
import { CheckoutPage } from '@/features/checkout/CheckoutPage'

export const Route = createFileRoute('/_authenticated/checkout')({
  head: () => ({ meta: [{ title: 'Pagamento · Kurio' }] }),
  component: CheckoutPage,
})
