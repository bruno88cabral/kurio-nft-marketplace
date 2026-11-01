import { CircleAlert, LoaderCircle, TicketPercent, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { CouponStatus } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** `idle` = vazio/editando; `applying` = request em andamento; os demais vêm de `Quote.coupon.status`. */
export type CouponInputStatus = 'idle' | 'applying' | CouponStatus

export interface CouponInputProps {
  status: CouponInputStatus
  /** Código gravado (normalizado pelo mock), exibido no estado `applied` e no nome do "Remover". */
  appliedCode?: string
  onApply: (code: string) => void
  /**
   * Remove o cupom gravado: botão "Remover" no estado `applied` e também em `invalid` e `expired` (o código
   * ruim continua gravado e entra nas próximas cotações até sair).
   */
  onRemove?: () => void
  /** Sobrescreve a mensagem padrão de `invalid` ("Cupom inválido.") / `expired` ("Cupom expirado."). */
  errorMessage?: string
  /**
   * Pagamento desktop (Figma `I70522:3321;70504:3154`): começa como o link "Tem um código
   * promocional? Aplique aqui", que expande o próprio campo no lugar. Abre sozinho fora de `idle`.
   */
  collapsible?: boolean
  /**
   * `default`: "Cupom de desconto" com o "Aplicar" separado. `attached` (Carrinho, Figma): rótulo "Código
   * promocional" em negrito e o campo colado ao "Aplicar" laranja; abaixo de `md` vira a pílula do Figma mobile.
   */
  appearance?: 'default' | 'attached'
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
  appearance = 'default',
  className,
}: CouponInputProps) {
  const attached = appearance === 'attached'
  const id = useId()
  const errorId = `${id}-error`
  const [code, setCode] = useState('')
  const [expanded, setExpanded] = useState(false)
  const applying = status === 'applying'
  const error = errorMessage ?? DEFAULT_ERROR[status]
  const removable = onRemove !== undefined && (status === 'invalid' || status === 'expired')
  // "Remover" desmonta o botão focado e o foco cairia no `body`: depois da remoção (status volta a `idle`) o foco
  // vai para o campo. Só vale para quem clicou em "Remover"; os outros estados não mexem no foco.
  const refocus = useRef(false)
  useEffect(() => {
    if (refocus.current && status === 'idle') {
      refocus.current = false
      document.getElementById(id)?.focus()
    }
  }, [status, id])
  const remove = () => {
    if (!onRemove) return
    refocus.current = true
    // No modo `collapsible` o campo não pode voltar a ser o link, senão não há onde pôr o foco
    setExpanded(true)
    onRemove()
  }

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
          <Button type="button" variant="ghost" size="sm" onClick={remove}>
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
    if (trimmed && !applying) {
      refocus.current = false
      onApply(trimmed)
    }
  }

  return (
    <div data-slot="coupon-input" data-status={status} className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={attached ? 'text-body text-foreground font-bold' : 'text-caption text-muted-foreground'}>
        {attached ? 'Código promocional' : 'Cupom de desconto'}
      </label>
      <div className={cn('flex', !attached && 'gap-2')}>
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
          placeholder={attached ? 'Digite o código promocional...' : 'Código'}
          readOnly={applying}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-10 uppercase placeholder:normal-case',
            attached &&
              'border-border-soft placeholder:text-muted-foreground rounded-r-none border-r-0 max-md:h-12 max-md:rounded-l-full max-md:pr-8 max-md:pl-5',
          )}
        />
        <Button
          type="button"
          variant={attached ? 'default' : 'secondary'}
          className={cn(
            'h-10 px-4',
            attached &&
              'text-body relative z-10 rounded-l-none font-bold max-md:from-text-accent max-md:to-primary max-md:-ml-6 max-md:h-12 max-md:rounded-full max-md:bg-linear-to-r max-md:px-6',
          )}
          onClick={submit}
          disabled={!code.trim()}
          aria-disabled={applying || undefined}
        >
          {applying && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
          {applying ? 'Aplicando…' : 'Aplicar'}
        </Button>
      </div>
      {(error || removable) && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {error && (
            <p id={errorId} role="alert" className="text-destructive text-caption inline-flex items-center gap-1.5">
              <CircleAlert aria-hidden className="size-3.5" />
              {error}
            </p>
          )}
          {removable && (
            <Button type="button" variant="ghost" size="sm" onClick={remove}>
              <X aria-hidden />
              Remover<span className="sr-only"> cupom{appliedCode ? ` ${appliedCode}` : ''}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
