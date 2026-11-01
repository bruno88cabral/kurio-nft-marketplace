import { useRef, useState } from 'react'
import { firstInvalidField, hasErrors, type FieldErrors } from '@/features/account/validation'
import { withCollector, type CheckoutDraft, type CheckoutDraftStore } from './checkoutDraft'
import { COLLECTOR_FIELDS, emptyCollector, validateCollector, type CollectorField, type CollectorValues } from './collectorForm'

export interface CollectorForm {
  values: CollectorValues
  errors: FieldErrors<CollectorField>
  /** Props do controle de um campo: valor, ref (foco no erro), troca (grava no rascunho) e blur (valida). */
  field: (key: CollectorField) => {
    name: CollectorField
    value: string
    ref: (el: HTMLElement | null) => void
    onChange: (event: { target: { value: string } }) => void
    onBlur: () => void
  }
  /** Valida tudo, mostra os erros e põe o foco no primeiro inválido. `true` = válido. */
  validateAll: () => boolean
}

/**
 * Estado do "Perfil do colecionador" (MYK-1114 D6/D7). Os valores vivem no rascunho do checkout
 * (`draft.collector`, sessionStorage): sobrevivem a refresh e caem no logout explícito. Nome de exibição e
 * e-mail vêm pré-carregados da conta até a pessoa editá-los (só o campo editado é gravado). Os erros são locais:
 * aparecem no blur de um campo editado e no envio, e somem ao editar (o padrão de `useAccountForm`).
 */
export function useCollectorForm({
  draft,
  drafts,
  prefill,
}: {
  draft: CheckoutDraft
  drafts: CheckoutDraftStore
  prefill: { displayName?: string; email?: string }
}): CollectorForm {
  const values: CollectorValues = { ...emptyCollector(prefill), ...draft.collector }
  const [errors, setErrors] = useState<FieldErrors<CollectorField>>({})
  // Campos editados nesta montagem: o blur só valida o que a pessoa mexeu (passar pelo campo vazio não acusa erro)
  const dirty = useRef(new Set<CollectorField>())
  const inputs = useRef<Partial<Record<CollectorField, HTMLElement | null>>>({})

  const field = (key: CollectorField) => ({
    name: key,
    value: values[key],
    ref: (el: HTMLElement | null) => {
      inputs.current[key] = el
    },
    onChange: (event: { target: { value: string } }) => {
      const current = drafts.get()
      dirty.current.add(key)
      // Só o campo editado: o pré-carregado (nome e e-mail) segue a conta até ser editado
      drafts.set(withCollector(current, { ...current.collector, [key]: event.target.value }))
      setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
    },
    onBlur: () => {
      if (!dirty.current.has(key)) return
      const message = validateCollector({ ...emptyCollector(prefill), ...drafts.get().collector })[key]
      setErrors((prev) => (prev[key] === message ? prev : { ...prev, [key]: message }))
    },
  })

  const validateAll = () => {
    const next = validateCollector(values)
    setErrors(next)
    if (!hasErrors(next)) return true
    const first = firstInvalidField(COLLECTOR_FIELDS, next)
    if (first) inputs.current[first]?.focus()
    return false
  }

  return { values, errors, field, validateAll }
}
