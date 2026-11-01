import { useId, type ReactNode } from 'react'
import { ATTEMPT_REVIEW_MESSAGE } from './reviewSource'
import { ReviewStep, type ReviewLine } from './ReviewStep'

/**
 * Seção do Pagamento com título. `number` é a etapa (1, 2, 3) quando as três aparecem; sem ele o título vem
 * sozinho (a seção "Pedido enviado" do carrinho vazio, que não é uma etapa de uma sequência).
 */
export function Step({ number, title, action, children }: { number?: number; title: string; action?: ReactNode; children: ReactNode }) {
  const generatedId = useId()
  const id = number === undefined ? generatedId : `checkout-etapa-${number}`
  return (
    <section aria-labelledby={id} className="border-border flex flex-col gap-4 rounded-lg border p-4">
      <header className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-body-lg flex items-center gap-2 font-medium">
          {number !== undefined && (
            <span aria-hidden className="bg-muted text-caption flex size-6 items-center justify-center rounded-full">
              {number}
            </span>
          )}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

/**
 * A lista da Revisão. Com `attempt`, as linhas são as da tentativa pendente e o aviso diz que são as do pedido
 * enviado. Usada pela etapa 3 do Pagamento e pelo "Pedido enviado" do carrinho vazio (`AttemptReview`).
 */
export function ReviewSection({
  number,
  title,
  attempt,
  lines,
}: {
  number?: number
  title: string
  attempt: boolean
  lines: readonly ReviewLine[]
}) {
  return (
    <Step number={number} title={title}>
      {attempt && <p className="text-muted-foreground text-caption">{ATTEMPT_REVIEW_MESSAGE}</p>}
      <ReviewStep lines={lines} />
    </Step>
  )
}
