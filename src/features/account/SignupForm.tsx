import { Link } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import { signup } from '@/api/auth'
import { FormField } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AUTH_COLUMN_CLASS, AUTH_INPUT_CLASS, AUTH_LABEL_CLASS, AUTH_SUBMIT_CLASS, FormAlert } from './AuthDialog'
import { AuthSwitchLink } from './AuthSwitchLink'
import { PasswordInput } from './PasswordInput'
import { SocialLogin } from './SocialLogin'
import { useAuthForm } from './useAuthForm'
import { DEMO_PASSWORD_NOTICE, SIGNUP_CONFLICT_MESSAGE, validateSignup, type SignupValues } from './validation'

const FIELDS = ['name', 'email', 'password', 'confirmPassword'] as const satisfies readonly (keyof SignupValues)[]

const linkClass =
  'text-text-accent focus-visible:ring-ring rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3'

/**
 * Cadastro do Figma, com o placeholder do Figma e um rótulo visível discreto acima de cada campo (o
 * Figma só tem placeholder, que some ao digitar; WCAG 3.3.2). "Nome de usuário" é o texto do Figma;
 * o contrato só tem o nome de exibição (`name`), que é o que este campo preenche.
 */
export function SignupForm({ redirect }: { redirect: string | undefined }) {
  const form = useAuthForm({
    fields: FIELDS,
    initial: { name: '', email: '', password: '', confirmPassword: '' },
    validate: validateSignup,
    request: ({ name, email, password }: SignupValues) =>
      signup({ name: name.trim(), email: email.trim(), password }),
    redirect,
  })
  const conflict = form.apiErrors.email === SIGNUP_CONFLICT_MESSAGE

  return (
    <div className="flex flex-col gap-8 md:gap-6">
      <form noValidate onSubmit={form.onSubmit} className={`${AUTH_COLUMN_CLASS} flex flex-col gap-4`}>
        <FormAlert message={form.formError} />
        <FormField label="Nome de usuário" labelClassName={AUTH_LABEL_CLASS} required error={form.errors.name} apiError={form.apiErrors.name}>
          {(control) => (
            <Input
              {...control}
              {...form.field('name')}
              autoComplete="name"
              placeholder="Nome de usuário"
              className={AUTH_INPUT_CLASS}
            />
          )}
        </FormField>
        <div className="flex flex-col gap-1.5">
          <FormField label="E-mail" labelClassName={AUTH_LABEL_CLASS} required error={form.errors.email} apiError={form.apiErrors.email}>
            {(control) => (
              <Input
                {...control}
                {...form.field('email')}
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="Digite seu e-mail"
                className={AUTH_INPUT_CLASS}
              />
            )}
          </FormField>
          {conflict && (
            <p className="text-caption">
              <Link to="/login" search={{ redirect }} replace className={linkClass}>
                Entrar com este e-mail
              </Link>
            </p>
          )}
        </div>
        <FormField
          label="Senha"
          labelClassName={AUTH_LABEL_CLASS}
          required
          description={DEMO_PASSWORD_NOTICE}
          error={form.errors.password}
          apiError={form.apiErrors.password}
        >
          {(control) => (
            <PasswordInput
              {...control}
              {...form.field('password')}
              autoComplete="new-password"
              placeholder="Senha"
              className={AUTH_INPUT_CLASS}
            />
          )}
        </FormField>
        <FormField
          label="Confirmar senha"
          labelClassName={AUTH_LABEL_CLASS}
          required
          error={form.errors.confirmPassword}
          apiError={form.apiErrors.confirmPassword}
        >
          {(control) => (
            <PasswordInput
              {...control}
              {...form.field('confirmPassword')}
              autoComplete="new-password"
              placeholder="Confirmar senha"
              className={AUTH_INPUT_CLASS}
            />
          )}
        </FormField>
        <Button
          type="submit"
          size="lg"
          className={`${AUTH_SUBMIT_CLASS} mt-4 md:mt-2`}
          disabled={form.submitting}
          aria-busy={form.submitting}
        >
          {form.submitting && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
          {form.submitting ? (
            'Criando conta…'
          ) : (
            <>
              {/* Figma: "Criar perfil" no mobile, "Criar conta" no modal do desktop */}
              <span className="md:hidden">Criar perfil</span>
              <span className="max-md:hidden">Criar conta</span>
            </>
          )}
        </Button>
      </form>

      <SocialLogin />

      <AuthSwitchLink prompt="Já tem uma conta?" label="Entre" to="/login" redirect={redirect} />
    </div>
  )
}
