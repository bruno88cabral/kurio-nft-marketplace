import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useRef, useState, type FormEvent } from 'react'
import { sessionLifecycle } from '@/auth/sessionLifecycle'
import type { AuthResponse } from '@/contracts'
import { firstInvalidField, hasErrors, toFormErrors, type FieldErrors } from './validation'

interface UseAuthFormOptions<K extends string, V extends Record<K, string>> {
  /** Campos na ordem visual (o foco vai para o primeiro com erro). */
  fields: readonly K[]
  initial: V
  validate: (values: V) => FieldErrors<K>
  request: (values: V) => Promise<AuthResponse>
  /** `redirect` já validado; sem ele, `/`. */
  redirect: string | undefined
}

/**
 * Estado comum de login e cadastro: valida no cliente (sem request se houver erro), envia,
 * estabelece a sessão pelo ciclo de vida (nunca grava a sessão à mão) e volta ao `redirect`.
 */
export function useAuthForm<K extends string, V extends Record<K, string>>({
  fields,
  initial,
  validate,
  request,
  redirect,
}: UseAuthFormOptions<K, V>) {
  const navigate = useNavigate()
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<FieldErrors<K>>({})
  const [apiErrors, setApiErrors] = useState<FieldErrors<K>>({})
  const [formError, setFormError] = useState<string>()
  const inputs = useRef<Partial<Record<K, HTMLInputElement | null>>>({})

  const focusFirstInvalid = (fieldErrors: FieldErrors<K>) => {
    const key = firstInvalidField(fields, fieldErrors)
    if (key) inputs.current[key]?.focus()
  }

  const mutation = useMutation({
    mutationFn: request,
    onSuccess: async (auth) => {
      await sessionLifecycle.establishSession(auth)
      await navigate({ href: redirect ?? '/', replace: true })
    },
    onError: (error) => {
      const next = toFormErrors(error, fields)
      setApiErrors(next.fieldErrors)
      setFormError(next.formError)
      focusFirstInvalid(next.fieldErrors)
    },
  })

  // Depois do sucesso o formulário continua ocupado até a navegação trocar de rota
  const submitting = mutation.isPending || mutation.isSuccess

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    const clientErrors = validate(values)
    setErrors(clientErrors)
    setApiErrors({})
    setFormError(undefined)
    if (hasErrors(clientErrors)) {
      focusFirstInvalid(clientErrors)
      return
    }
    mutation.mutate(values)
  }

  /** Props do `<Input>` de um campo: valor, ref (foco no erro) e limpeza do erro ao editar. */
  const field = (key: K) => ({
    name: key,
    value: values[key],
    ref: (el: HTMLInputElement | null) => {
      inputs.current[key] = el
    },
    onChange: (event: { target: { value: string } }) => {
      const value = event.target.value
      setValues((prev) => ({ ...prev, [key]: value }))
      setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
      setApiErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
    },
  })

  return { values, errors, apiErrors, formError, submitting, onSubmit, field }
}
