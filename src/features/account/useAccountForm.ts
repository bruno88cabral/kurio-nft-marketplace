import { useMutation } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { firstInvalidField, hasErrors, toFormErrors, type FieldErrors, type ToFormErrorsOptions } from './validation'

export interface UseAccountFormOptions<K extends string, V extends Record<K, string>, R> extends ToFormErrorsOptions {
  /** Campos na ordem visual (o foco vai para o primeiro com erro). */
  fields: readonly K[]
  initial: V
  validate: (values: V) => FieldErrors<K>
  request: (values: V) => Promise<R>
  onSuccess?: (result: R, values: V) => void | Promise<void>
  /**
   * Mantém o formulário ocupado depois do sucesso (login e cadastro: até a navegação trocar de rota).
   * Padrão `false`: o formulário volta a aceitar envio.
   */
  busyAfterSuccess?: boolean
}

/**
 * Estado comum dos formulários da conta (login, cadastro, perfil, senha): valida no cliente (sem
 * request se houver erro, foco no primeiro campo inválido), envia e traduz a falha em erro de
 * campo (`apiErrors`) ou do formulário (`formError`).
 */
export function useAccountForm<K extends string, V extends Record<K, string>, R>({
  fields,
  initial,
  validate,
  request,
  onSuccess,
  busyAfterSuccess = false,
  unauthorizedMessage,
}: UseAccountFormOptions<K, V, R>) {
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
    onSuccess: (result, submitted) => onSuccess?.(result, submitted),
    onError: (error) => {
      const next = toFormErrors(error, fields, { unauthorizedMessage })
      setApiErrors(next.fieldErrors)
      setFormError(next.formError)
      focusFirstInvalid(next.fieldErrors)
    },
  })

  const submitting = mutation.isPending || (busyAfterSuccess && mutation.isSuccess)

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

  /** Volta aos valores dados e limpa todos os erros (ex.: depois de salvar). */
  const reset = (next: V) => {
    setValues(next)
    setErrors({})
    setApiErrors({})
    setFormError(undefined)
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

  return { values, errors, apiErrors, formError, submitting, onSubmit, field, reset }
}
