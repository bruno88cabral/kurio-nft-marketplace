import { CircleAlert, LoaderCircle, TicketPercent, X } from 'lucide-react'
import { useId, useState } from 'react'
import type { CouponStatus } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** `idle` = vazio/editando; `applying` = request em andamento; os demais vêm de `Quote.coupon.status`. */
export type CouponInputStatus = 'idle' | 'applying' | CouponStatus

export interface CouponInputProps {
  status: CouponInputStatus
  /** Código já aplicado (normalizado pelo mock), exibido no estado `applied`. */
  appliedCode?: string
  onApply: (code: string) => void
  /** Remove o cupom aplicado (botão "Remover" no estado `applied`). */
  onRemove?: () => void
  /** Sobrescreve a mensagem padrão de `invalid` ("Cupom inválido.") / `expired` ("Cupom expirado."). */
  errorMessage?: string
  /**
   * Pagamento desktop (Figma `I70522:3321;70504:3154`): começa como o link "Tem um código
   * promocional? Aplique aqui", que expande o próprio campo no lugar. Abre sozinho fora de `idle`.
   */
  collapsible?: boolean
  className?: string
}

const DEFAULT_ERROR: Partial<Record<CouponInputStatus, string>> = {
  invalid: 'Cupom inválido.',
  expired: 'Cupom expirado.',
}

/**
 * Campo de cupom (Carrinho; Pagamento no modo `collapsible`). O texto digitado é estado local;
 * o resultado (`applied`/`invalid`/`expired`) vem do consumidor, que lê da cotação.
 */
export function CouponInput({
  status,
  appliedCode,
  onApply,
  onRemove,
  errorMessage,
  collapsible = false,
  className,
}: CouponInputProps) {
  const id = useId()
  const errorId = `${id}-error`
  const [code, setCode] = useState('')
  const [expanded, setExpanded] = useState(false)
  const applying = status === 'applying'
  const error = errorMessage ?? DEFAULT_ERROR[status]

  if (status === 'applied') {
    return (
      <div
        data-slot="coupon-input"
        data-status={status}
        role="status"
        className={cn('border-border bg-card flex items-center justify-between gap-3 rounded-md border px-3 py-2', className)}
      >
        <span className="text-body inline-flex items-center gap-2">
          <TicketPercent aria-hidden className="text-text-accent size-4" />
          Cupom <strong className="font-bold">{appliedCode}</strong> aplicado
        </span>
        {onRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <X aria-hidden />
            Remover<span className="sr-only"> cupom {appliedCode}</span>
          </Button>
        )}
      </div>
    )
  }

  if (collapsible && !expanded && status === 'idle') {
    return (
      <Button
        type="button"
        variant="link"
        className={cn('h-auto self-start px-0 text-caption whitespace-normal', className)}
        aria-expanded={false}
        onClick={() => setExpanded(true)}
      >
        Tem um código promocional? Aplique aqui
      </Button>
    )
  }

  const submit = () => {
    const trimmed = code.trim()
    if (trimmed && !applying) onApply(trimmed)
  }

  return (
    <div data-slot="coupon-input" data-status={status} className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-caption text-muted-foreground">
        Cupom de desconto
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          // Foco ao expandir pelo link (só no modo collapsible; não rouba foco na carga)
          autoFocus={collapsible}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Código"
          readOnly={applying}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-10 uppercase placeholder:normal-case"
        />
        <Button
          type="button"
          variant="secondary"
          className="h-10 px-4"
          onClick={submit}
          disabled={!code.trim()}
          aria-disabled={applying || undefined}
        >
          {applying && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
          {applying ? 'Aplicando…' : 'Aplicar'}
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-destructive text-caption inline-flex items-center gap-1.5">
          <CircleAlert aria-hidden className="size-3.5" />
          {error}
        </p>
      )}
    </div>
  )
}
