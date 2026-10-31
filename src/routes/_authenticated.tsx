import { Outlet, createFileRoute, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { getToken } from '@/auth/sessionStorage'
import { sessionQuery } from '@/auth/useSession'
import { ErrorState } from '@/components/kurio'
import { isUnauthorized } from '@/contracts'
import { toLogin } from '@/features/account/authGuards'

// Rotas privadas (perfil, carteiras, checkout, pedido): sem sessão vão para /login?redirect=<aqui>
// e voltam depois de entrar. Com o token guardado, a sessão é confirmada (do cache, se já veio).
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context: { queryClient }, location }) => {
    if (getToken() === null) throw toLogin(location.href)
    try {
      await queryClient.ensureQueryData(sessionQuery())
    } catch (error) {
      // 401 com o token atual: o `notifyExpired` limpa a sessão e cancela as queries privadas, então
      // aqui costuma chegar o `CancelledError` da query, não o `ApiError`. Sem token depois da
      // falha a sessão morreu: vai direto ao login (sem passar pelo errorComponent). Com token, é
      // falha de rede/servidor e cai no errorComponent sem apagar a sessão.
      if (isUnauthorized(error) || getToken() === null) throw toLogin(location.href)
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
