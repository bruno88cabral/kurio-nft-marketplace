import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { changePassword } from '@/api/profile'
import { SESSION_EXPIRED_MESSAGE } from '@/auth/sessionLifecycle'
import { FormField } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { FormAlert } from './AuthDialog'
import { PasswordInput } from './PasswordInput'
import { useAccountForm } from './useAccountForm'
import {
  DEMO_PASSWORD_NOTICE,
  MIN_PASSWORD_LENGTH,
  PASSWORD_CHANGED_MESSAGE,
  validatePassword,
  type PasswordValues,
} from './validation'

const FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const satisfies readonly (keyof PasswordValues)[]
const EMPTY: PasswordValues = { currentPassword: '', newPassword: '', confirmPassword: '' }

/**
 * "Alterar senha": atual, nova e confirmação. A confirmação diferente (e o resto da validação)
 * para antes do envio; "Senha atual incorreta." (422) volta no campo. Sucesso limpa os campos e
 * avisa "Senha alterada.". A troca não encerra a sessão (contrato do mock).
 */
export function PasswordForm({ email }: { email: string }) {
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

  return (
    <form noValidate onSubmit={form.onSubmit} className="flex max-w-xl flex-col gap-4">
      {/* Para o gerenciador de senhas associar a nova senha à conta */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <FormAlert message={form.formError} />
      <FormField
        label="Senha atual"
        required
        error={form.errors.currentPassword}
        apiError={form.apiErrors.currentPassword}
      >
        {(control) => <PasswordInput {...control} {...form.field('currentPassword')} autoComplete="current-password" className="h-11" />}
      </FormField>
      <FormField
        label="Nova senha"
        required
        description={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres. ${DEMO_PASSWORD_NOTICE}`}
        error={form.errors.newPassword}
        apiError={form.apiErrors.newPassword}
      >
        {(control) => <PasswordInput {...control} {...form.field('newPassword')} autoComplete="new-password" className="h-11" />}
      </FormField>
      <FormField
        label="Confirmar nova senha"
        required
        error={form.errors.confirmPassword}
        apiError={form.apiErrors.confirmPassword}
      >
        {(control) => <PasswordInput {...control} {...form.field('confirmPassword')} autoComplete="new-password" className="h-11" />}
      </FormField>
      <div>
        <Button
          type="submit"
          size="lg"
          className="h-11 w-full sm:w-auto"
          disabled={form.submitting}
          aria-busy={form.submitting || undefined}
        >
          {form.submitting && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
          {form.submitting ? 'Alterando…' : 'Alterar senha'}
        </Button>
      </div>
    </form>
  )
}
