import type { CouponStatus, EthAmount, Id, Quote, QuoteIssue } from '@/contracts'
import { eqEth, formatEthLabel } from '@/lib/eth'
import { lineKey } from '@/features/cart/cartView'

/** O que o usuário revisou: só os valores que a tela mostra (o `quoteId` muda a cada cotação e não conta). */
export interface ReviewSnapshot {
  quoteId: Id
  total: EthAmount
  networkFee: EthAmount
  couponStatus?: CouponStatus
  /** Por linha (`nftId:edition`): preço unitário congelado e quantidade. */
  lines: Record<string, { unitPrice: EthAmount; quantity: number }>
  /** `nftId:edition:kind`, ordenado. */
  issues: string[]
}

export function snapshotOf(quote: Quote): ReviewSnapshot {
  const lines: ReviewSnapshot['lines'] = {}
  for (const item of quote.items) lines[lineKey(item)] = { unitPrice: item.unitPrice, quantity: item.quantity }
  return {
    quoteId: quote.quoteId,
    total: quote.total,
    networkFee: quote.networkFee,
    couponStatus: quote.coupon?.status,
    lines,
    issues: (quote.issues ?? []).map((i: QuoteIssue) => `${lineKey(i)}:${i.kind}`).sort(),
  }
}

export type SnapshotChange =
  | { kind: 'total' | 'networkFee'; before: EthAmount; after: EthAmount }
  | { kind: 'coupon'; before?: CouponStatus; after?: CouponStatus }
  | { kind: 'unitPrice'; line: string; before: EthAmount; after: EthAmount }
  | { kind: 'quantity'; line: string; before: number; after: number }
  | { kind: 'line'; line: string; change: 'added' | 'removed' }
  | { kind: 'issues' }

/** Diferenças entre o revisado e a cotação nova. Vazio = pode enviar. Compara ETH com `Big`, nunca string. */
export function diffSnapshots(before: ReviewSnapshot, after: ReviewSnapshot): SnapshotChange[] {
  const changes: SnapshotChange[] = []
  for (const line of Object.keys(before.lines)) {
    const a = before.lines[line]
    const b = after.lines[line]
    if (!a) continue
    if (!b) {
      changes.push({ kind: 'line', line, change: 'removed' })
      continue
    }
    if (!eqEth(a.unitPrice, b.unitPrice)) changes.push({ kind: 'unitPrice', line, before: a.unitPrice, after: b.unitPrice })
    if (a.quantity !== b.quantity) changes.push({ kind: 'quantity', line, before: a.quantity, after: b.quantity })
  }
  for (const line of Object.keys(after.lines)) {
    if (!(line in before.lines)) changes.push({ kind: 'line', line, change: 'added' })
  }
  if (before.couponStatus !== after.couponStatus) {
    changes.push({ kind: 'coupon', before: before.couponStatus, after: after.couponStatus })
  }
  if (!eqEth(before.networkFee, after.networkFee)) {
    changes.push({ kind: 'networkFee', before: before.networkFee, after: after.networkFee })
  }
  if (!eqEth(before.total, after.total)) changes.push({ kind: 'total', before: before.total, after: after.total })
  if (before.issues.join('|') !== after.issues.join('|')) changes.push({ kind: 'issues' })
  return changes
}

const COUPON_LABEL: Record<CouponStatus, string> = { applied: 'aplicado', invalid: 'inválido', expired: 'expirado' }

/**
 * Textos das mudanças: as de linha vão para a linha da revisão (`byLine`), o resto para o aviso do resumo.
 * Só formata: nenhum valor é calculado aqui.
 */
export function changeMessages(changes: readonly SnapshotChange[]): { byLine: Map<string, string>; summary: string[] } {
  const byLine = new Map<string, string>()
  const summary: string[] = []
  for (const change of changes) {
    switch (change.kind) {
      case 'unitPrice':
        byLine.set(change.line, `Preço alterado de ${formatEthLabel(change.before)} para ${formatEthLabel(change.after)}.`)
        break
      case 'quantity':
        byLine.set(change.line, `Quantidade alterada de ${change.before} para ${change.after}.`)
        break
      case 'line':
        summary.push(change.change === 'added' ? 'Um item entrou no carrinho.' : 'Um item saiu do carrinho.')
        break
      case 'coupon':
        summary.push(
          `Cupom ${change.after ? COUPON_LABEL[change.after] : 'removido'}${change.before ? ` (antes ${COUPON_LABEL[change.before]})` : ''}.`,
        )
        break
      case 'networkFee':
        summary.push(`Taxa de rede: de ${formatEthLabel(change.before)} para ${formatEthLabel(change.after)}.`)
        break
      case 'total':
        summary.push(`Total: de ${formatEthLabel(change.before)} para ${formatEthLabel(change.after)}.`)
        break
      case 'issues':
        summary.push('A disponibilidade dos itens mudou.')
        break
    }
  }
  return { byLine, summary }
}
