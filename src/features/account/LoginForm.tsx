import { Link } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'
import { login } from '@/api/auth'
import { FormField, OutOfScopeAction } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormAlert } from './AuthDialog'
import { PasswordInput } from './PasswordInput'
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
    <div className="flex flex-col gap-6">
      <form noValidate onSubmit={form.onSubmit} className="flex flex-col gap-4">
        <FormAlert message={form.formError} />
        {/* Figma (70381:242/243): sem rótulo visível; o rótulo fica para leitor de tela */}
        <FormField label="E-mail" hideLabel required error={form.errors.email} apiError={form.apiErrors.email}>
          {(control) => (
            <Input
              {...control}
              {...form.field('email')}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="E-mail"
              className="bg-background dark:bg-background h-11"
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
              className="bg-background dark:bg-background h-11"
            />
          )}
        </FormField>
        <div className="flex justify-end">
          <OutOfScopeAction variant="link" size="sm" className="h-auto px-0">
            Esqueceu a senha?
          </OutOfScopeAction>
        </div>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={form.submitting} aria-busy={form.submitting}>
          {form.submitting && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
          {form.submitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <SocialLogin />

      <p className="text-muted-foreground text-caption text-center">
        Não tem conta?{' '}
        <Link
          to="/signup"
          search={{ redirect }}
          replace
          className="text-text-accent focus-visible:ring-ring rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3"
        >
          Criar conta
        </Link>
      </p>
    </div>
  )
}

/** Login social (Figma 70484:260/240): fora do escopo, "Em breve". */
export function SocialLogin() {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-muted-foreground text-caption flex items-center gap-3">
        <span aria-hidden className="bg-border h-px flex-1" />
        ou
        <span aria-hidden className="bg-border h-px flex-1" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <OutOfScopeAction variant="outline" className="h-11 w-full">
          Continuar com Google
        </OutOfScopeAction>
        <OutOfScopeAction variant="outline" className="h-11 w-full">
          Continuar com Apple
        </OutOfScopeAction>
      </div>
    </div>
  )
}
