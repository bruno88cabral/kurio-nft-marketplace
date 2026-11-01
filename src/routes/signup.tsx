import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthDialog } from '@/features/account/AuthDialog'
import { authenticatedDestination } from '@/features/account/authGuards'
import { SignupForm } from '@/features/account/SignupForm'
import { validateRedirectSearch } from '@/lib/redirectSearch'

export const Route = createFileRoute('/signup')({
  head: () => ({ meta: [{ title: 'Criar conta · Kurio' }] }),
  validateSearch: validateRedirectSearch,
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
    <AuthDialog title="Criar conta" description="Crie sua conta para favoritar e comprar NFTs." redirect={redirect}>
      <SignupForm redirect={redirect} />
    </AuthDialog>
  )
}
