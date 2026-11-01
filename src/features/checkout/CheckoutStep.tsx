import { useId, type ReactNode } from 'react'
import { ATTEMPT_REVIEW_MESSAGE } from './reviewSource'
import { ReviewStep, type ReviewLine } from './ReviewStep'

/**
 * Seção com título e borda. Hoje serve ao "Pedido enviado" do carrinho vazio (`AttemptReview`); o Pagamento com
 * carrinho segue o layout do Figma, sem etapas numeradas (MYK-1120).
 */
export function Step({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="border-border flex flex-col gap-4 rounded-lg border p-4">
      <header className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-body-lg flex items-center gap-2 font-medium">
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

/**
 * A lista de itens com título. Com `attempt`, as linhas são as da tentativa pendente e o aviso diz que são as do
 * pedido enviado. Usada pelo "Pedido enviado" do carrinho vazio (`AttemptReview`).
 */
export function ReviewSection({ title, attempt, lines }: { title: string; attempt: boolean; lines: readonly ReviewLine[] }) {
  return (
    <Step title={title}>
      {attempt && <p className="text-muted-foreground text-caption">{ATTEMPT_REVIEW_MESSAGE}</p>}
      <ReviewStep lines={lines} />
    </Step>
  )
}
