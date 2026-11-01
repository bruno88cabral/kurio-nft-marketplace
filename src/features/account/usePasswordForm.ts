import { toast } from 'sonner'
import { changePassword } from '@/api/profile'
import { SESSION_EXPIRED_MESSAGE } from '@/auth/sessionLifecycle'
import { useAccountForm } from './useAccountForm'
import { PASSWORD_CHANGED_MESSAGE, validatePassword, type PasswordValues } from './validation'

const FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const satisfies readonly (keyof PasswordValues)[]
const EMPTY: PasswordValues = { currentPassword: '', newPassword: '', confirmPassword: '' }

/**
 * Estado de "Alterar senha": atual, nova e confirmação. A confirmação diferente (e o resto da
 * validação) para antes do envio; "Senha atual incorreta." (422) volta no campo. Sucesso limpa os
 * campos e avisa "Senha alterada.". A troca não encerra a sessão (contrato do mock). O envio é do
 * "Salvar" único do Perfil (`ProfileForm`, MYK-1102).
 */
export function usePasswordForm() {
  const form = useAccountForm({
    fields: FIELDS,
    initial: EMPTY,
    validate: validatePassword,
    request: ({ currentPassword, newPassword }: PasswordValues) => changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      form.reset(EMPTY)
      toast.success(PASSWORD_CHANGED_MESSAGE)
    },
    unauthorizedMessage: SESSION_EXPIRED_MESSAGE,
  })
  /** Algum campo preenchido: a troca de senha entra no "Salvar". */
  const touched = FIELDS.some((key) => form.values[key] !== '')
  return { ...form, touched }
}

export type PasswordFormState = ReturnType<typeof usePasswordForm>
