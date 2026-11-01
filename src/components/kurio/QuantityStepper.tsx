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
  /** `md` = Detalhe (103×49.5, Figma `70410:4189`), `sm` = botões 24×24 (`16:658`). Ignorado com `appearance="cart"`. */
  size?: 'md' | 'sm'
  /** Nome acessível do campo (padrão "Quantidade"). */
  label?: string
  /** Mostra o rótulo visível curto "Qtd." à esquerda (Detalhe mobile, `16:355`). */
  showLabel?: boolean
  /**
   * `boxed` (padrão) = botões com borda dentro de uma caixa; `accent` = botões laranja
   * sólidos em pílula, sem caixa, com alvo de 44 px (Detalhe no Figma); `cart` = Carrinho do Figma, com
   * alvo de 44 px: abaixo de `md` círculos com contorno e sem preenchimento, a partir de `md` pílulas
   * pequenas laranja sólido (o desenho fica num `span` dentro do botão de 44 px).
   */
  appearance?: 'boxed' | 'accent' | 'cart'
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
  appearance = 'boxed',
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
  const accent = appearance === 'accent'
  const cart = appearance === 'cart'
  const buttonClass = cart
    ? 'group/step focus-visible:ring-ring inline-flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40'
    : cn(
    'focus-visible:ring-ring focus-visible:border-ring inline-flex shrink-0 items-center justify-center border outline-none transition-colors focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40',
    accent
      ? 'bg-primary text-primary-foreground hover:bg-primary/80 focus-visible:ring-offset-background h-12 w-11 rounded-full border-transparent focus-visible:ring-offset-2 aria-disabled:hover:bg-primary'
      : 'border-border-soft text-foreground hover:bg-muted aria-disabled:hover:bg-transparent',
    !accent && (sm ? 'size-6 rounded-sm' : 'size-9 rounded-md'),
  )
  /** Desenho do botão no `cart`: círculo com contorno no celular, pílula laranja a partir de `md`. */
  const cartFace =
    'border-border-soft text-foreground group-hover/step:bg-muted inline-flex size-8 items-center justify-center rounded-full border transition-colors md:bg-primary md:text-primary-foreground md:group-hover/step:bg-primary/80 md:h-6 md:w-5 md:border-transparent'
  const icon = (Icon: typeof Minus) =>
    cart ? (
      <span aria-hidden className={cartFace}>
        <Icon className="size-4 md:size-3" />
      </span>
    ) : (
      <Icon aria-hidden className={sm ? 'size-3' : accent ? 'size-5' : 'size-4'} />
    )

  return (
    <div data-slot="quantity-stepper" className={cn('inline-flex flex-col gap-1', className)}>
      <div className="inline-flex items-center gap-2">
        {showLabel && (
          <label htmlFor={id} className={cn('text-muted-foreground', accent ? 'text-body-lg' : 'text-caption')}>
            Qtd.
          </label>
        )}
        <div
          className={cn(
            'inline-flex items-center',
            accent ? 'gap-1' : cart ? '-mx-2.5 md:-mx-3' : 'border-border rounded-md border',
            !accent && !cart && (sm ? 'gap-1 p-0.5' : 'gap-1.5 p-1'),
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
            {icon(Minus)}
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
              'focus-visible:ring-ring rounded-sm bg-transparent text-center font-medium tabular-nums outline-none focus-visible:ring-3 disabled:opacity-50',
              cart ? 'text-body h-8 w-7' : sm ? 'h-6 w-7 text-caption' : accent ? 'text-body-lg h-11 w-11' : 'h-9 w-9 text-body',
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
            {icon(Plus)}
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
