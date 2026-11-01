import { LoaderCircle } from 'lucide-react'
import { login } from '@/api/auth'
import { FormField, OutOfScopeAction } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AUTH_COLUMN_CLASS, AUTH_INPUT_CLASS, AUTH_SUBMIT_CLASS, FormAlert } from './AuthDialog'
import { AuthSwitchLink } from './AuthSwitchLink'
import { PasswordInput } from './PasswordInput'
import { SocialLogin } from './SocialLogin'
import { useAuthForm } from './useAuthForm'
import { validateLogin, type LoginValues } from './validation'

const FIELDS = ['email', 'password'] as const satisfies readonly (keyof LoginValues)[]

export function LoginForm({ redirect }: { redirect: string | undefined }) {
  const form = useAuthForm({
    fields: FIELDS,
    initial: { email: '', password: '' },
    validate: validateLogin,
    request: ({ email, password }: LoginValues) => login({ email: email.trim(), password }),
    redirect,
  })

  return (
    <div className="flex flex-col gap-8 md:gap-6">
      <form noValidate onSubmit={form.onSubmit} className={`${AUTH_COLUMN_CLASS} flex flex-col gap-4`}>
        <FormAlert message={form.formError} />
        {/* Figma: sem rótulo visível, só o placeholder; o rótulo fica para o leitor de tela */}
        <FormField label="E-mail" hideLabel required error={form.errors.email} apiError={form.apiErrors.email}>
          {(control) => (
            <Input
              {...control}
              {...form.field('email')}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="contato@email.com"
              className={AUTH_INPUT_CLASS}
            />
          )}
        </FormField>
        <FormField label="Senha" hideLabel required error={form.errors.password} apiError={form.apiErrors.password}>
          {(control) => (
            <PasswordInput
              {...control}
              {...form.field('password')}
              autoComplete="current-password"
              placeholder="Senha"
              className={AUTH_INPUT_CLASS}
            />
          )}
        </FormField>
        <div className="flex justify-end">
          <OutOfScopeAction variant="link" size="sm" className="text-text-accent h-auto px-0 opacity-100">
            Esqueceu a senha?
          </OutOfScopeAction>
        </div>
        <Button
          type="submit"
          size="lg"
          className={`${AUTH_SUBMIT_CLASS} mt-4 md:mt-2`}
          disabled={form.submitting}
          aria-busy={form.submitting}
        >
          {form.submitting && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
          {form.submitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <SocialLogin />

      <AuthSwitchLink prompt="Novo na Kurio?" label="Crie uma conta" to="/signup" redirect={redirect} />
    </div>
  )
}
