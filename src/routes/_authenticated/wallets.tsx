import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/wallets')({
  head: () => ({ meta: [{ title: 'Carteiras · Kurio' }] }),
  component: WalletsPage,
})

function WalletsPage() {
  return <h1>Carteiras</h1>
}
