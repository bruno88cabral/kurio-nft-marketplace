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
   * `quote` (padrão): cotação, a taxa de rede leva "Estimada". `receipt`: valores já cobrados (recibo do pedido),
   * sem o "Estimada".
   */
  mode?: 'quote' | 'receipt'
  className?: string
}

/**
 * Resumo de valores (Carrinho, Pagamento, Confirmação): subtotal, desconto (só com cupom aplicado
 * ou desconto > 0), taxa de rede (com "Estimada" abaixo, exceto no modo `receipt`), separador e total.
 */
export function PriceSummary({
  quote,
  loading = false,
  stale = false,
  staleMessage = 'Os valores mudaram desde a última cotação. Revise antes de continuar.',
  staleAction,
  title,
  mode = 'quote',
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
        <SummarySkeleton />
      ) : (
        <dl className={cn('flex flex-col gap-2 text-body', stale && 'opacity-60')}>
          <Row label="Subtotal" value={formatEthLabel(quote.subtotal)} />
          {(quote.coupon?.status === 'applied' || cmpEth(quote.discount, ZERO) > 0) && (
            <Row
              label={quote.coupon ? `Desconto (${quote.coupon.code})` : 'Desconto'}
              value={`− ${formatEthLabel(quote.discount)}`}
              valueClassName="text-text-accent"
            />
          )}
          <Row
            label={
              mode === 'receipt' ? (
                'Taxa de rede'
              ) : (
                <span className="flex flex-col">
                  <span>Taxa de rede</span>
                  <span className="text-muted-foreground text-tiny">Estimada</span>
                </span>
              )
            }
            value={formatEthLabel(quote.networkFee)}
          />
          <Separator className="my-1" />
          <Row
            label="Total"
            value={formatEthLabel(quote.total)}
            className="text-body-lg font-bold"
          />
        </dl>
      )}
    </section>
  )
}

function Row({
  label,
  value,
  className,
  valueClassName,
}: {
  label: ReactNode
  value: string
  className?: string
  valueClassName?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('text-foreground text-right tabular-nums', valueClassName)}>{value}</dd>
    </div>
  )
}

/** Mesma caixa do resumo pronto sem cupom (subtotal, taxa de rede com "Estimada", separador, total): 113px. */
function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <div className="flex h-[21px] items-center justify-between gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
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
