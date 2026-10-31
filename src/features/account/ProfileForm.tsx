import { useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { profileKeys, updateProfile } from '@/api/profile'
import { SESSION_EXPIRED_MESSAGE } from '@/auth/sessionLifecycle'
import type { Profile } from '@/contracts'
import { FormField } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { FormAlert } from './AuthDialog'
import { AvatarField } from './AvatarField'
import { useAccountForm } from './useAccountForm'
import { MAX_DISPLAY_NAME, PROFILE_UPDATED_MESSAGE, validateProfile, type ProfileValues } from './validation'

const FIELDS = ['displayName'] as const satisfies readonly (keyof ProfileValues)[]

/** Altura comum dos campos (o skeleton usa a mesma). */
const FIELD_CLASS = 'h-11'

interface ProfileFormProps {
  profile: Profile
  /** Da `Account` da sessão: não tem rota de edição. */
  email: string
}

/**
 * "Dados do perfil": avatar (salva sozinho) e nome de exibição (obrigatório, até 60, com
 * contador). E-mail só leitura. "Salvar" só habilita quando o nome mudou; o sucesso grava o
 * perfil devolvido no cache (`setQueryData`) e avisa "Perfil atualizado.".
 */
export function ProfileForm({ profile, email }: ProfileFormProps) {
  const queryClient = useQueryClient()
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
  const length = form.values.displayName.trim().length
  const dirty = form.values.displayName.trim() !== profile.displayName

  return (
    <div className="flex flex-col gap-6">
      <AvatarField profile={profile} />
      <form noValidate onSubmit={form.onSubmit} className="flex max-w-xl flex-col gap-4">
        <FormAlert message={form.formError} />
        <FormField
          label="Nome de exibição"
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
        <FormField label="E-mail" description="O e-mail não pode ser alterado.">
          {(control) => <Input {...control} type="email" value={email} readOnly className={`${FIELD_CLASS} text-muted-foreground`} />}
        </FormField>
        <div>
          <Button
            type="submit"
            size="lg"
            className="h-11 w-full sm:w-auto"
            disabled={!dirty || form.submitting}
            aria-busy={form.submitting || undefined}
          >
            {form.submitting && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {form.submitting ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </div>
  )
}

/** Mesmas caixas do `ProfileForm` (avatar 80/96 px, dois campos de 44 px, botão). */
export function ProfileFormSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Skeleton className="size-20 rounded-full motion-reduce:animate-none sm:size-24" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-11 w-40 motion-reduce:animate-none" />
          <Skeleton className="h-4 w-48 motion-reduce:animate-none" />
        </div>
      </div>
      <div className="flex max-w-xl flex-col gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-32 motion-reduce:animate-none" />
            <Skeleton className={`${FIELD_CLASS} w-full motion-reduce:animate-none`} />
            <Skeleton className="h-3 w-40 motion-reduce:animate-none" />
          </div>
        ))}
        <Skeleton className="h-11 w-full motion-reduce:animate-none sm:w-24" />
      </div>
    </div>
  )
}
