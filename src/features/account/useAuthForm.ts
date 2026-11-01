import { useNavigate } from '@tanstack/react-router'
import { sessionLifecycle } from '@/auth/sessionLifecycle'
import type { AuthResponse } from '@/contracts'
import { useAccountForm } from './useAccountForm'
import type { FieldErrors } from './validation'

interface UseAuthFormOptions<K extends string, V extends Record<K, string>> {
  /** Campos na ordem visual (o foco vai para o primeiro com erro). */
  fields: readonly K[]
  initial: V
  validate: (values: V) => FieldErrors<K>
  request: (values: V) => Promise<AuthResponse>
  /** `redirect` já validado; sem ele, `/`. */
  redirect: string | undefined
}

/**
 * Estado comum de login e cadastro: valida no cliente (sem request se houver erro), envia,
 * estabelece a sessão pelo ciclo de vida (nunca grava a sessão à mão) e volta ao `redirect`.
 */
export function useAuthForm<K extends string, V extends Record<K, string>>({
  fields,
  initial,
  validate,
  request,
  redirect,
}: UseAuthFormOptions<K, V>) {
  const navigate = useNavigate()
  return useAccountForm({
    fields,
    initial,
    validate,
    request,
    onSuccess: async (auth) => {
      await sessionLifecycle.establishSession(auth)
      await navigate({ href: redirect ?? '/', replace: true })
    },
    // Depois do sucesso o formulário continua ocupado até a navegação trocar de rota
    busyAfterSuccess: true,
  })
}
