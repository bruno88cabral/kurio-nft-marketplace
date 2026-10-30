import { createFileRoute } from '@tanstack/react-router'
import { validateRedirectSearch } from '@/lib/redirectSearch'

export const Route = createFileRoute('/login')({
  head: () => ({ meta: [{ title: 'Entrar · Kurio' }] }),
  validateSearch: validateRedirectSearch,
  component: LoginPage,
})

function LoginPage() {
  return <h1>Entrar</h1>
}
