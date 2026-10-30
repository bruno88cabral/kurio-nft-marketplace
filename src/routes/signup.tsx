import { createFileRoute } from '@tanstack/react-router'
import { validateRedirectSearch } from '@/lib/redirectSearch'

export const Route = createFileRoute('/signup')({
  validateSearch: validateRedirectSearch,
  component: SignupPage,
})

function SignupPage() {
  return <h1>Criar conta</h1>
}
