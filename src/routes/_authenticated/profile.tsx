import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/profile')({
  head: () => ({ meta: [{ title: 'Perfil · Kurio' }] }),
  component: ProfilePage,
})

function ProfilePage() {
  return <h1>Perfil</h1>
}
