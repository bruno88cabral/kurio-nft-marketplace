import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, LoaderCircle, UserRound } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { profileKeys, updateProfile } from '@/api/profile'
import { captureSession, isSameSession } from '@/auth/sessionGuard'
import { SESSION_EXPIRED_MESSAGE } from '@/auth/sessionLifecycle'
import type { Profile } from '@/contracts'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ACCOUNT_LABEL_CLASS } from './AccountLayout'
import { AVATAR_ACCEPT, AVATAR_MESSAGES, checkAvatarFile, initials, readAsDataUrl } from './avatar'
import { PROFILE_UPDATED_MESSAGE, toFormErrors } from './validation'

/**
 * Avatar do perfil em linha (Figma, MYK-1102): círculo pequeno com a imagem ou as iniciais, "Alterar"
 * laranja sólido (input de arquivo com label, salva na hora) e "Remover" como texto (`avatarUrl: ''`); os
 * nomes acessíveis são "Alterar avatar" e "Remover avatar". Arquivo de tipo ou tamanho inválido mostra
 * o erro sem request. A imagem não é redimensionada.
 */
export function AvatarField({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient()
  const id = useId()
  const inputId = `${id}-input`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const titleId = `${id}-title`
  const inputRef = useRef<HTMLInputElement>(null)
  const refocusInput = useRef(false)
  const [error, setError] = useState<string>()
  const [reading, setReading] = useState(false)

  const mutation = useMutation({
    mutationFn: (avatarUrl: string) => updateProfile({ avatarUrl }),
    // Resposta depois de um logout/troca de conta: sem toast nem escrita na chave da conta anterior
    onMutate: captureSession,
    onSuccess: (next, avatarUrl, sameSession) => {
      if (!isSameSession(sameSession)) return
      queryClient.setQueryData(profileKeys.detail(next.accountId), next)
      toast.success(PROFILE_UPDATED_MESSAGE)
      // "Remover" some depois de remover: o foco volta para "Alterar avatar" (quando reabilitar)
      if (avatarUrl === '') refocusInput.current = true
    },
    onError: (failure, _avatarUrl, sameSession) => {
      if (!isSameSession(sameSession)) return
      const { fieldErrors, formError } = toFormErrors(failure, ['avatarUrl'], {
        unauthorizedMessage: SESSION_EXPIRED_MESSAGE,
      })
      setError(fieldErrors.avatarUrl ?? formError)
    },
  })
  const removing = mutation.isPending && mutation.variables === ''
  const uploading = reading || (mutation.isPending && !removing)
  const busy = uploading || removing

  useEffect(() => {
    if (busy || !refocusInput.current) return
    refocusInput.current = false
    inputRef.current?.focus()
  }, [busy])

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Limpa para que escolher o mesmo arquivo de novo dispare `change`
    event.target.value = ''
    if (!file) return
    const invalid = checkAvatarFile(file)
    setError(invalid)
    if (invalid) return
    setReading(true)
    try {
      mutation.mutate(await readAsDataUrl(file))
    } catch {
      setError(AVATAR_MESSAGES.readFailed)
    } finally {
      setReading(false)
    }
  }

  const remove = () => {
    setError(undefined)
    mutation.mutate('')
  }

  const name = profile.displayName
  const label = `Avatar de ${name}`
  const fallback = initials(name)

  return (
    <div data-slot="avatar-field" role="group" aria-labelledby={titleId} className="flex min-w-0 flex-col gap-2">
      <p id={titleId} className={ACCOUNT_LABEL_CLASS}>
        Avatar
      </p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Avatar aria-busy={busy || undefined} className="bg-card size-12">
          {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={label} />}
          <AvatarFallback role="img" aria-label={label} className="bg-card text-text-accent text-body">
            {fallback ? <span aria-hidden>{fallback}</span> : <UserRound aria-hidden className="size-5" />}
          </AvatarFallback>
        </Avatar>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={AVATAR_ACCEPT}
          disabled={busy}
          aria-describedby={cn(hintId, error && errorId)}
          aria-invalid={error ? true : undefined}
          onChange={(event) => void onFileChange(event)}
          className="peer sr-only"
        />
        {/* Figma: "Alterar" laranja sólido; o nome acessível continua "Alterar avatar" */}
        <label
          htmlFor={inputId}
          className={cn(
            buttonVariants({ variant: 'default' }),
            'h-11 cursor-pointer px-6 font-bold peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring peer-disabled:pointer-events-none peer-disabled:opacity-50',
          )}
        >
          {uploading && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
          Alterar{' '}<span className="sr-only">avatar</span>
        </label>
        {profile.avatarUrl && (
          <Button type="button" variant="ghost" className="h-11 px-2 font-normal" disabled={busy} onClick={remove}>
            {removing && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
            Remover{' '}<span className="sr-only">avatar</span>
          </Button>
        )}
      </div>
      <p id={hintId} className="text-muted-foreground text-tiny">
        PNG, JPEG, WebP ou GIF, até 140 KB.
      </p>
      {error && (
        <p id={errorId} role="alert" className="text-destructive text-caption inline-flex items-center gap-1.5">
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
