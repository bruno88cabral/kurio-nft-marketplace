import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthDialog } from '@/features/account/AuthDialog'
import { authenticatedDestination } from '@/features/account/authGuards'
import { LoginForm } from '@/features/account/LoginForm'
import { validateRedirectSearch } from '@/lib/redirectSearch'

export const Route = createFileRoute('/login')({
  head: () => ({ meta: [{ title: 'Entrar · Kurio' }] }),
  validateSearch: validateRedirectSearch,
  // Mobile: página inteira, sem header nem tab bar (Figma); o "Voltar" e o Esc fecham
  staticData: { hideMobileChrome: true },
  // Já logado: vai direto para o redirect (ou /), sem abrir o modal
  beforeLoad: ({ search }) => {
    const href = authenticatedDestination(search)
    if (href !== null) throw redirect({ href, replace: true })
  },
  component: LoginPage,
})

function LoginPage() {
  const { redirect } = Route.useSearch()
  return (
    <AuthDialog mode="login" redirect={redirect}>
      <LoginForm redirect={redirect} />
    </AuthDialog>
  )
}
