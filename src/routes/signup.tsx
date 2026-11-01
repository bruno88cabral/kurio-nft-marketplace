import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthDialog } from '@/features/account/AuthDialog'
import { authenticatedDestination } from '@/features/account/authGuards'
import { SignupForm } from '@/features/account/SignupForm'
import { validateRedirectSearch } from '@/lib/redirectSearch'

export const Route = createFileRoute('/signup')({
  head: () => ({ meta: [{ title: 'Criar conta · Kurio' }] }),
  validateSearch: validateRedirectSearch,
  // Mobile: página inteira, sem header nem tab bar (Figma); o "Voltar" e o Esc fecham
  staticData: { hideMobileChrome: true },
  // Já logado: vai direto para o redirect (ou /), sem abrir o modal
  beforeLoad: ({ search }) => {
    const href = authenticatedDestination(search)
    if (href !== null) throw redirect({ href, replace: true })
  },
  component: SignupPage,
})

function SignupPage() {
  const { redirect } = Route.useSearch()
  return (
    <AuthDialog mode="signup" redirect={redirect}>
      <SignupForm redirect={redirect} />
    </AuthDialog>
  )
}
