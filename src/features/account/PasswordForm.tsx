import { FormField } from '@/components/kurio'
import { ACCOUNT_LABEL_CLASS } from './AccountLayout'
import { FormAlert } from './AuthDialog'
import { PasswordInput } from './PasswordInput'
import type { PasswordFormState } from './usePasswordForm'
import { DEMO_PASSWORD_NOTICE, MIN_PASSWORD_LENGTH } from './validation'

/**
 * Campos de "Alterar senha" (Figma: uma coluna, com o olho de mostrar senha). Sem asterisco: a
 * troca é opcional; com qualquer campo preenchido, os três passam a ser validados.
 */
export function PasswordFields({ form, email, className }: { form: PasswordFormState; email: string; className?: string }) {
  return (
    <div className={className}>
      {/* Para o gerenciador de senhas associar a nova senha à conta */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <div className="flex flex-col gap-4">
        <FormAlert message={form.formError} />
        <FormField label="Senha atual" labelClassName={ACCOUNT_LABEL_CLASS} error={form.errors.currentPassword} apiError={form.apiErrors.currentPassword}>
          {(control) => (
            <PasswordInput
              {...control}
              {...form.field('currentPassword')}
              readOnly={form.submitting}
              autoComplete="current-password"
              className="h-11"
            />
          )}
        </FormField>
        <FormField
          label="Nova senha" labelClassName={ACCOUNT_LABEL_CLASS}
          description={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres. ${DEMO_PASSWORD_NOTICE}`}
          error={form.errors.newPassword}
          apiError={form.apiErrors.newPassword}
        >
          {(control) => (
            <PasswordInput
              {...control}
              {...form.field('newPassword')}
              readOnly={form.submitting}
              autoComplete="new-password"
              className="h-11"
            />
          )}
        </FormField>
        <FormField
          label="Confirmar nova senha" labelClassName={ACCOUNT_LABEL_CLASS}
          error={form.errors.confirmPassword}
          apiError={form.apiErrors.confirmPassword}
        >
          {(control) => (
            <PasswordInput
              {...control}
              {...form.field('confirmPassword')}
              readOnly={form.submitting}
              autoComplete="new-password"
              className="h-11"
            />
          )}
        </FormField>
      </div>
    </div>
  )
}
