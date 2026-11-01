import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Quote } from '@/contracts'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { cmpEth, formatEthLabel, parseEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

const ZERO = parseEth('0')

export type PriceSummaryValues = Pick<Quote, 'subtotal' | 'discount' | 'networkFee' | 'total' | 'coupon'>

export interface PriceSummaryProps {
  /** Valores da cotação (o cliente não calcula: só formata). Sem `quote`, renderiza o skeleton. */
  quote?: PriceSummaryValues
  /** Força o skeleton mesmo com `quote` (ex.: recotando). */
  loading?: boolean
  /**
   * Estado "desatualizado": a cotação mudou (preço/estoque) e precisa ser revista. Mostra um
   * aviso com ícone e texto e esmaece os valores; a ação de recotar é do consumidor (`staleAction`).
   */
  stale?: boolean
  staleMessage?: string
  staleAction?: ReactNode
  /** Título opcional acima das linhas (ex.: "Resumo"). */
  title?: string
  /**
   * `quote` (padrão): cotação, a taxa de rede leva "Taxa estimada". `receipt`: valores já cobrados (recibo do
   * pedido), sem o "Taxa estimada".
   */
  mode?: 'quote' | 'receipt'
  /**
   * Mostra a linha do desconto mesmo sem cupom, como "(-) 0 ETH" (Carrinho no Figma, MYK-1115). Sem ela, o
   * desconto só aparece com cupom aplicado ou desconto > 0 (Pagamento, revisão e recibo).
   */
  alwaysShowDiscount?: boolean
  className?: string
}

/**
 * Resumo de valores (Carrinho, Pagamento, Confirmação): subtotal, desconto (só com cupom aplicado
 * ou desconto > 0, ou sempre com `alwaysShowDiscount`), taxa de rede (com "Taxa estimada" em laranja
 * abaixo do valor, exceto no modo `receipt`), separador e total com o valor em laranja (Figma).
 */
export function PriceSummary({
  quote,
  loading = false,
  stale = false,
  staleMessage = 'Os valores mudaram desde a última cotação. Revise antes de continuar.',
  staleAction,
  title,
  mode = 'quote',
  alwaysShowDiscount = false,
  className,
}: PriceSummaryProps) {
  const showSkeleton = loading || !quote

  return (
    <section
      data-slot="price-summary"
      aria-busy={showSkeleton || undefined}
      aria-label={title ? undefined : 'Resumo de valores'}
      className={cn('flex flex-col gap-3', className)}
    >
      {title && <h2 className="text-body-lg font-medium">{title}</h2>}
      {stale && !showSkeleton && (
        <div
          role="status"
          className="border-text-accent/60 bg-text-accent/10 text-foreground flex flex-col gap-2 rounded-md border p-3 text-caption"
        >
          <p className="flex items-start gap-2">
            <TriangleAlert aria-hidden className="text-text-accent mt-0.5 size-4 shrink-0" />
            <span>
              <strong className="font-medium">Cotação desatualizada.</strong> {staleMessage}
            </span>
          </p>
          {staleAction}
        </div>
      )}
      {showSkeleton ? (
        <SummarySkeleton discount={alwaysShowDiscount} />
      ) : (
        <dl className={cn('text-foreground flex flex-col gap-2 text-body', stale && 'opacity-60')}>
          <Row label="Subtotal" value={formatEthLabel(quote.subtotal)} />
          {(alwaysShowDiscount || quote.coupon?.status === 'applied' || cmpEth(quote.discount, ZERO) > 0) && (
            <Row
              label={quote.coupon?.status === 'applied' ? `Desconto (${quote.coupon.code})` : 'Desconto'}
              value={`(-) ${formatEthLabel(quote.discount)}`}
            />
          )}
          <Row
            label="Taxa de rede"
            value={formatEthLabel(quote.networkFee)}
            hint={mode === 'receipt' ? undefined : 'Taxa estimada'}
          />
          {/* A linha acima do total é a borda da própria linha: um separador solto dentro do `<dl>` o invalida
              (só `dt`/`dd`, axe `definition-list`); mesma altura de antes (my-1 + 1px) */}
          <Row
            label="Total"
            value={formatEthLabel(quote.total)}
            className="border-border text-body-lg mt-1 border-t pt-3 font-bold"
            valueClassName="text-text-accent"
          />
        </dl>
      )}
    </section>
  )
}

function Row({
  label,
  value,
  hint,
  className,
  valueClassName,
}: {
  label: ReactNode
  value: string
  /** Nota pequena em laranja, alinhada à direita abaixo do valor (ex.: "Taxa estimada"). */
  hint?: string
  className?: string
  valueClassName?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <dt>{label}</dt>
      <dd className={cn('text-foreground flex flex-col items-end text-right tabular-nums', valueClassName)}>
        {value}
        {hint && <span className="text-text-accent text-tiny">{hint}</span>}
      </dd>
    </div>
  )
}

/**
 * Mesma caixa do resumo pronto sem cupom (subtotal, taxa de rede com "Taxa estimada", separador, total): 113px.
 * Com `discount` (o `alwaysShowDiscount` do Carrinho) entra também a linha do desconto.
 */
function SummarySkeleton({ discount }: { discount: boolean }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <div className="flex h-[21px] items-center justify-between gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
      {discount && (
        <div className="flex h-[21px] items-center justify-between gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      )}
      <div className="flex h-[35px] items-center justify-between gap-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Separator className="my-1" />
      <div className="flex h-6 items-center justify-between gap-4">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-24" />
      </div>
    </div>
  )
}
