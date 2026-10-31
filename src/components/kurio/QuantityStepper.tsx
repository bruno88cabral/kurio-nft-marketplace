import { Minus, Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { clampInt, clampQuantity } from '@/lib/quantity'
import { cn } from '@/lib/utils'

export interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  /** Padrão 1: com o mínimo, o "−" fica desabilitado (não vira "remover"; Figma `16:355`). */
  min?: number
  /** Limite da edição (`available`). No máximo, o "+" desabilita e aparece "Máximo: N". */
  max: number
  disabled?: boolean
  /** `md` = Detalhe (103×49.5, Figma `70410:4189`), `sm` = Carrinho (botões 24×24, `16:658`). */
  size?: 'md' | 'sm'
  /** Nome acessível do campo (padrão "Quantidade"). */
  label?: string
  /** Mostra o rótulo visível curto "Qtd." à esquerda (Detalhe mobile, `16:355`). */
  showLabel?: boolean
  className?: string
}

/**
 * Stepper controlado. O texto digitado é rascunho local; vale ao sair do campo ou com Enter,
 * limitado a `[min, max]` (`clampQuantity`). ↑/↓ no campo também incrementam.
 * Nos limites o botão usa `aria-disabled` (não `disabled`) para o foco do teclado não se perder
 * quando o valor chega ao mínimo/máximo; `disabled` (prop) desabilita tudo de verdade.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  size = 'md',
  label = 'Quantidade',
  showLabel = false,
  className,
}: QuantityStepperProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const [draft, setDraft] = useState<string | null>(null)
  const atMin = value <= min
  const atMax = value >= max

  const commit = (next: number) => {
    setDraft(null)
    const clamped = clampInt(next, min, max)
    if (clamped !== value) onChange(clamped)
  }

  const sm = size === 'sm'
  const buttonClass = cn(
    'border-border-soft text-foreground hover:bg-muted focus-visible:ring-ring/50 focus-visible:border-ring inline-flex shrink-0 items-center justify-center border outline-none transition-colors focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent',
    sm ? 'size-6 rounded-sm' : 'size-9 rounded-md',
  )

  return (
    <div data-slot="quantity-stepper" className={cn('inline-flex flex-col gap-1', className)}>
      <div className="inline-flex items-center gap-2">
        {showLabel && (
          <label htmlFor={id} className="text-muted-foreground text-caption">
            Qtd.
          </label>
        )}
        <div
          className={cn(
            'border-border inline-flex items-center rounded-md border',
            sm ? 'gap-1 p-0.5' : 'gap-1.5 p-1',
          )}
        >
          <button
            type="button"
            className={buttonClass}
            onClick={() => !atMin && commit(value - 1)}
            disabled={disabled}
            aria-disabled={atMin || undefined}
            aria-label="Diminuir quantidade"
          >
            <Minus aria-hidden className={sm ? 'size-3' : 'size-4'} />
          </button>
          <input
            id={id}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={label}
            aria-describedby={atMax ? hintId : undefined}
            disabled={disabled}
            value={draft ?? String(value)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => draft !== null && commit(clampQuantity(draft, min, max, value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft !== null) commit(clampQuantity(draft, min, max, value))
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                commit(value + 1)
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                commit(value - 1)
              }
            }}
            className={cn(
              'focus-visible:ring-ring/50 rounded-sm bg-transparent text-center font-medium tabular-nums outline-none focus-visible:ring-3 disabled:opacity-50',
              sm ? 'h-6 w-7 text-caption' : 'h-9 w-9 text-body',
            )}
          />
          <button
            type="button"
            className={buttonClass}
            onClick={() => !atMax && commit(value + 1)}
            disabled={disabled}
            aria-disabled={atMax || undefined}
            aria-label="Aumentar quantidade"
          >
            <Plus aria-hidden className={sm ? 'size-3' : 'size-4'} />
          </button>
        </div>
      </div>
      {atMax && !disabled && (
        <span id={hintId} className="text-muted-foreground text-tiny">
          Máximo: {max}
        </span>
      )}
    </div>
  )
}
