import { createFileRoute } from '@tanstack/react-router'
import { validateRedirectSearch } from '@/lib/redirectSearch'

export const Route = createFileRoute('/signup')({
  head: () => ({ meta: [{ title: 'Criar conta · Kurio' }] }),
  validateSearch: validateRedirectSearch,
  component: SignupPage,
})

function SignupPage() {
  return <h1>Criar conta</h1>
}
