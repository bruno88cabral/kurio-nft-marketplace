import { ArrowDown, ArrowUp } from 'lucide-react'
import type { EthAmount } from '@/contracts'
import { cmpEth, formatEthLabel } from '@/lib/eth'
import { cn } from '@/lib/utils'

export interface PriceTagProps {
  price: EthAmount
  /**
   * Preço anterior, exibido riscado ao lado (promoção ou preço que mudou em tempo real).
   * Ignorado quando é igual a `price`.
   */
  previousPrice?: EthAmount
  /**
   * Estado "alterado (tempo real)": destaca o preço e mostra "Subiu"/"Caiu" com ícone em
   * relação a `previousPrice` (sem `previousPrice`, mostra só "Atualizado").
   */
  changed?: boolean
  /** `sm` = card do carrossel/carrinho, `md` = card do grid, `lg` = Detalhe. */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Anuncia mudanças para leitor de tela (`aria-live="polite"`). Use em UMA instância por tela
   * (ex.: o preço do Detalhe), nunca em todos os cards de uma lista.
   */
  live?: boolean
  className?: string
}

const SIZE = {
  sm: 'text-caption',
  md: 'text-body',
  lg: 'text-heading',
} as const

/** Preço em ETH formatado (`formatEthLabel`), com preço anterior riscado opcional. */
export function PriceTag({ price, previousPrice, changed = false, size = 'md', live = false, className }: PriceTagProps) {
  const direction = previousPrice ? cmpEth(price, previousPrice) : 0
  const showPrevious = previousPrice !== undefined && direction !== 0

  return (
    <span
      data-slot="price-tag"
      data-changed={changed || undefined}
      aria-live={live ? 'polite' : undefined}
      aria-atomic={live ? true : undefined}
      className={cn('inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5', SIZE[size], className)}
    >
      <span
        className={cn(
          'font-medium text-foreground tabular-nums transition-colors',
          changed && 'text-text-accent',
        )}
      >
        <span className="sr-only">Preço: </span>
        {formatEthLabel(price)}
      </span>
      {showPrevious && (
        <s className="text-muted-foreground text-[0.85em] tabular-nums">
          <span className="sr-only">Preço anterior: </span>
          {formatEthLabel(previousPrice)}
        </s>
      )}
      {changed && (
        <span className="text-text-accent inline-flex items-center gap-0.5 self-center text-tiny font-medium uppercase">
          {direction > 0 && <ArrowUp aria-hidden className="size-3" />}
          {direction < 0 && <ArrowDown aria-hidden className="size-3" />}
          {direction > 0 ? 'Subiu' : direction < 0 ? 'Caiu' : 'Atualizado'}
        </span>
      )}
    </span>
  )
}
