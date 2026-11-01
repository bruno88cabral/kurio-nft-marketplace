import { Link } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import { signup } from '@/api/auth'
import { FormField } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormAlert } from './AuthDialog'
import { PasswordInput } from './PasswordInput'
import { useAuthForm } from './useAuthForm'
import { DEMO_PASSWORD_NOTICE, SIGNUP_CONFLICT_MESSAGE, validateSignup, type SignupValues } from './validation'

const FIELDS = ['name', 'email', 'password', 'confirmPassword'] as const satisfies readonly (keyof SignupValues)[]

const linkClass =
  'text-text-accent focus-visible:ring-ring rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3'

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
    <div className="flex flex-col gap-6">
      <form noValidate onSubmit={form.onSubmit} className="flex flex-col gap-4">
        <FormAlert message={form.formError} />
        <FormField label="Nome" required error={form.errors.name} apiError={form.apiErrors.name}>
          {(control) => <Input {...control} {...form.field('name')} autoComplete="name" className="bg-background dark:bg-background h-11" />}
        </FormField>
        <div className="flex flex-col gap-1.5">
          <FormField label="E-mail" required error={form.errors.email} apiError={form.apiErrors.email}>
            {(control) => (
              <Input
                {...control}
                {...form.field('email')}
                type="email"
                autoComplete="email"
                inputMode="email"
                className="bg-background dark:bg-background h-11"
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
          required
          description={DEMO_PASSWORD_NOTICE}
          error={form.errors.password}
          apiError={form.apiErrors.password}
        >
          {(control) => (
            <PasswordInput {...control} {...form.field('password')} autoComplete="new-password" className="bg-background dark:bg-background h-11" />
          )}
        </FormField>
        <FormField
          label="Confirmar senha"
          required
          error={form.errors.confirmPassword}
          apiError={form.apiErrors.confirmPassword}
        >
          {(control) => (
            <PasswordInput
              {...control}
              {...form.field('confirmPassword')}
              autoComplete="new-password"
              className="bg-background dark:bg-background h-11"
            />
          )}
        </FormField>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={form.submitting} aria-busy={form.submitting}>
          {form.submitting && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
          {form.submitting ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>

      <p className="text-muted-foreground text-caption text-center">
        Já tem conta?{' '}
        <Link to="/login" search={{ redirect }} replace className={linkClass}>
          Entrar
        </Link>
      </p>
    </div>
  )
}
