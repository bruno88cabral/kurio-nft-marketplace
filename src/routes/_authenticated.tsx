import { Outlet, createFileRoute, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { getToken } from '@/auth/sessionStorage'
import { sessionQuery } from '@/auth/useSession'
import { ErrorState } from '@/components/kurio'
import { isUnauthorized, toLogin } from '@/features/account/authGuards'

// Rotas privadas (perfil, carteiras, checkout, pedido): sem sessão vão para /login?redirect=<aqui>
// e voltam depois de entrar. Com o token guardado, a sessão é confirmada (do cache, se já veio).
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context: { queryClient }, location }) => {
    if (getToken() === null) throw toLogin(location.href)
    try {
      await queryClient.ensureQueryData(sessionQuery())
    } catch (error) {
      // O 401 com o token atual também chama notifyExpired (toast + a mesma navegação para /login)
      if (isUnauthorized(error)) throw toLogin(location.href)
      throw error
    }
  },
  errorComponent: AuthenticatedError,
  component: Outlet,
})

function AuthenticatedError({ reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16">
      <ErrorState
        title="Não foi possível confirmar sua sessão."
        description="Verifique sua conexão e tente de novo."
        onRetry={() => {
          reset()
          void router.invalidate()
        }}
      />
    </div>
  )
}
