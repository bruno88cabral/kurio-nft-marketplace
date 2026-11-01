import { useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import { useId, type FormEvent } from 'react'
import { toast } from 'sonner'
import { profileKeys, updateProfile } from '@/api/profile'
import { SESSION_EXPIRED_MESSAGE } from '@/auth/sessionLifecycle'
import type { Profile } from '@/contracts'
import { FormField } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ACCOUNT_HEADING_CLASS, ACCOUNT_LABEL_CLASS } from './AccountLayout'
import { FormAlert } from './AuthDialog'
import { AvatarField } from './AvatarField'
import { PasswordFields } from './PasswordForm'
import { useAccountForm } from './useAccountForm'
import { usePasswordForm } from './usePasswordForm'
import { hasErrors, MAX_DISPLAY_NAME, PROFILE_UPDATED_MESSAGE, validateProfile, type ProfileValues } from './validation'

const FIELDS = ['displayName'] as const satisfies readonly (keyof ProfileValues)[]

/** Altura comum dos campos (o skeleton usa a mesma). */
const FIELD_CLASS = 'h-11'
/** Grade do Figma: 2 colunas a partir de `md`, uma coluna no celular. */
const GRID_CLASS = 'grid grid-cols-1 gap-x-7 gap-y-6 md:grid-cols-2'

interface ProfileFormProps {
  profile: Profile
  /** Da `Account` da sessão: não tem rota de edição. */
  email: string
}

/**
 * "Perfil do colecionador" (Figma `Desktop/Perfil do Colecionador.png`, MYK-1102), sem cards: à esquerda
 * Nome de exibição (obrigatório, até 60, com contador) e E-mail (só leitura); à direita o Avatar (salva
 * sozinho); abaixo "Alterar senha" numa coluna e um único "Salvar".
 *
 * Perfil e senha têm endpoints diferentes (`PATCH /profile` e `POST /profile/password`): o "Salvar" valida
 * no cliente o que mudou (o nome, se diferente do salvo; a senha, se algum campo foi preenchido) e, sem
 * erro em nenhum dos dois, envia cada um. Cada envio tem seu toast e seus erros nos próprios campos; com
 * erro de cliente em qualquer um, nada é enviado e o foco vai para o primeiro campo inválido.
 */
export function ProfileForm({ profile, email }: ProfileFormProps) {
  const queryClient = useQueryClient()
  const passwordHeadingId = useId()
  const form = useAccountForm({
    fields: FIELDS,
    initial: { displayName: profile.displayName },
    validate: validateProfile,
    request: ({ displayName }: ProfileValues) => updateProfile({ displayName: displayName.trim() }),
    onSuccess: (next: Profile) => {
      queryClient.setQueryData(profileKeys.detail(next.accountId), next)
      form.reset({ displayName: next.displayName })
      toast.success(PROFILE_UPDATED_MESSAGE)
    },
    unauthorizedMessage: SESSION_EXPIRED_MESSAGE,
  })
  const password = usePasswordForm()
  const length = form.values.displayName.trim().length
  const dirty = form.values.displayName.trim() !== profile.displayName
  const submitting = form.submitting || password.submitting

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    const profileErrors = dirty ? form.check() : {}
    const passwordErrors = password.touched ? password.check() : {}
    if (hasErrors(profileErrors) || hasErrors(passwordErrors)) {
      // Ordem visual: o nome vem antes da senha
      if (hasErrors(profileErrors)) form.focusFirstInvalid(profileErrors)
      else password.focusFirstInvalid(passwordErrors)
      return
    }
    if (dirty) form.send()
    if (password.touched) password.send()
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-10">
      <div className={GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-6">
          <FormAlert message={form.formError} />
          <FormField
            label="Nome de exibição" labelClassName={ACCOUNT_LABEL_CLASS}
            required
            description={`${length} de ${MAX_DISPLAY_NAME} caracteres`}
            error={form.errors.displayName}
            apiError={form.apiErrors.displayName}
          >
            {(control) => (
              // Só leitura durante o PATCH: o reset do sucesso apagaria o que fosse digitado nesse meio-tempo
              <Input
                {...control}
                {...form.field('displayName')}
                readOnly={form.submitting}
                autoComplete="nickname"
                className={FIELD_CLASS}
              />
            )}
          </FormField>
          <FormField label="E-mail" labelClassName={ACCOUNT_LABEL_CLASS} description="O e-mail não pode ser alterado.">
            {(control) => (
              <Input {...control} type="email" value={email} readOnly className={`${FIELD_CLASS} text-muted-foreground`} />
            )}
          </FormField>
        </div>
        <AvatarField profile={profile} />
      </div>

      <section aria-labelledby={passwordHeadingId} className={GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-6">
          <h2 id={passwordHeadingId} className={ACCOUNT_HEADING_CLASS}>
            Alterar senha
          </h2>
          <PasswordFields form={password} email={email} />
        </div>
      </section>

      <div>
        <Button
          type="submit"
          size="lg"
          className="h-11 w-full px-12 font-bold sm:w-auto"
          disabled={(!dirty && !password.touched) || submitting}
          aria-busy={submitting || undefined}
        >
          {submitting && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
          {submitting ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </form>
  )
}

/** Mesmas caixas do `ProfileForm`: grade de 2 colunas (nome, e-mail | avatar), senha numa coluna e "Salvar". */
export function ProfileFormSkeleton() {
  const field = (i: number, help = true) => (
    <div key={i} className="flex flex-col gap-1.5">
      <Skeleton className="h-4 w-32" />
      <Skeleton className={`${FIELD_CLASS} w-full`} />
      {help && <Skeleton className="h-3 w-40" />}
    </div>
  )
  return (
    <div aria-hidden className="flex flex-col gap-10">
      <div className={GRID_CLASS}>
        <div className="flex flex-col gap-6">
          {field(0)}
          {field(1)}
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-16" />
          <div className="flex items-center gap-4">
            <Skeleton className="size-12 rounded-full" />
            <Skeleton className="h-11 w-28" />
          </div>
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <div className={GRID_CLASS}>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-6 w-36" />
          <div className="flex flex-col gap-4">
            {field(2, false)}
            {field(3)}
            {field(4, false)}
          </div>
        </div>
      </div>
      <Skeleton className="h-11 w-full sm:w-36" />
    </div>
  )
}
