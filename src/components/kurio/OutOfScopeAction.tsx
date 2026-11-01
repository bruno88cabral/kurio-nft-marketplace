import type { VariantProps } from 'class-variance-authority'
import type { MouseEvent, ReactNode } from 'react'
import { toast } from 'sonner'
import { buttonVariants } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export const OUT_OF_SCOPE_LABEL = 'Em breve'

/** `id` fixo do toast: cliques seguidos atualizam o mesmo toast em vez de empilhar vários. */
export const OUT_OF_SCOPE_TOAST_ID = 'out-of-scope'

/**
 * Retorno ao clique ou toque (R-28): o tooltip do Radix não abre no toque, então o toque avisaria
 * nada. `toast.info` é o tom informativo (ícone de info, sem verde): não pode parecer sucesso.
 */
function announceOutOfScope(e: MouseEvent<HTMLButtonElement>) {
  e.preventDefault()
  toast.info(OUT_OF_SCOPE_LABEL, { id: OUT_OF_SCOPE_TOAST_ID })
}

export interface OutOfScopeActionProps extends VariantProps<typeof buttonVariants> {
  /** Conteúdo visível (texto e/ou ícone). */
  children: ReactNode
  /**
   * Nome acessível quando `children` é só ícone (ex.: "Compartilhar"). O componente acrescenta
   * " (em breve)" ao nome; com texto visível, o sufixo vai num `sr-only`.
   */
  label?: string
  /** Lado do tooltip (padrão `top`). */
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}

/**
 * Padrão único para ações fora do escopo do desafio (decisão de UX no ARCHITECTURE.md):
 * botão **desabilitado + tooltip "Em breve"**. Usa `aria-disabled` em vez de `disabled` para
 * continuar focável por Tab (o tooltip abre com foco e com hover). O clique (mouse, toque, ou
 * Enter/Espaço, que o navegador converte em um único `click`) não executa nada: só mostra o toast
 * informativo "Em breve" (R-28). Não há `onKeyDown`, para o Enter não gerar um segundo toast.
 * `variant`/`size` são os do `Button` (ex.: `variant="link"` para links do header/footer).
 */
export function OutOfScopeAction({
  children,
  label,
  side = 'top',
  variant = 'ghost',
  size,
  className,
}: OutOfScopeActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-disabled="true"
          aria-label={label ? `${label} (${OUT_OF_SCOPE_LABEL.toLowerCase()})` : undefined}
          data-out-of-scope=""
          onClick={announceOutOfScope}
          className={cn(
            buttonVariants({ variant, size }),
            'cursor-not-allowed opacity-60 hover:bg-transparent active:translate-y-0',
            variant === 'link' && 'hover:no-underline',
            className,
          )}
        >
          {children}
          {!label && <span className="sr-only"> ({OUT_OF_SCOPE_LABEL.toLowerCase()})</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent side={side}>{OUT_OF_SCOPE_LABEL}</TooltipContent>
    </Tooltip>
  )
}
