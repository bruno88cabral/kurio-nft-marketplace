import { CircleAlert } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Props que o `FormField` entrega ao controle (espalhe no `<Input>`, `<SelectTrigger>` etc.). */
export interface FormFieldControlProps {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': true | undefined
  'aria-required': true | undefined
  disabled: boolean | undefined
}

export interface FormFieldProps {
  label: string
  /** Mostra o asterisco (decorativo) e marca o controle com `aria-required`. */
  required?: boolean
  /** Erro de validação do cliente (tem prioridade sobre `apiError`). */
  error?: string
  /** Erro do servidor para este campo: `ApiError.fieldErrors[nome]`. */
  apiError?: string
  /** Texto de ajuda abaixo do controle. */
  description?: string
  disabled?: boolean
  /**
   * Esconde o rótulo visualmente mas mantém o nome acessível (Login do Figma, `70381:242`/`243`,
   * e `70390:253` não têm rótulo visível).
   */
  hideLabel?: boolean
  /** Render prop: recebe `id`, `aria-*` e `disabled` para ligar o controle ao rótulo e ao erro. */
  children: (control: FormFieldControlProps) => ReactNode
  className?: string
}

/**
 * Campo de formulário: rótulo (com asterisco se obrigatório), controle, ajuda e erro associado
 * via `aria-describedby`. Serve para input, select ou controle composto (ex.: ENS = select + input).
 */
export function FormField({
  label,
  required = false,
  error,
  apiError,
  description,
  disabled,
  hideLabel = false,
  children,
  className,
}: FormFieldProps) {
  const id = useId()
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`
  const message = error ?? apiError
  const describedBy = [description && descriptionId, message && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div
      data-slot="form-field"
      data-invalid={message ? true : undefined}
      data-disabled={disabled || undefined}
      className={cn('flex flex-col gap-1.5', className)}
    >
      <Label htmlFor={id} className={cn('text-caption', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <span aria-hidden className="text-text-accent">
            *
          </span>
        )}
      </Label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': message ? true : undefined,
        'aria-required': required || undefined,
        disabled,
      })}
      {description && (
        <p id={descriptionId} className="text-muted-foreground text-tiny">
          {description}
        </p>
      )}
      {message && (
        <p id={errorId} className="text-destructive text-caption inline-flex items-center gap-1.5">
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
          {message}
        </p>
      )}
    </div>
  )
}
