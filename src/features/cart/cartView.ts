import type { CartItem, CouponStatus, EthAmount, Quote, QuoteIssue } from '@/contracts'
import { eqEth } from '@/lib/eth'
import type { CouponInputStatus } from '@/components/kurio'

export const lineKey = (item: Pick<CartItem, 'nftId' | 'edition'>) => `${item.nftId}:${item.edition}`

/** Divergências da cotação por linha (`nftId:edition`). `unavailable` vale mais que `price_changed`. */
export function issuesByLine(issues: readonly QuoteIssue[] | undefined): Map<string, QuoteIssue['kind']> {
  const map = new Map<string, QuoteIssue['kind']>()
  for (const issue of issues ?? []) {
    const key = lineKey(issue)
    if (map.get(key) !== 'unavailable') map.set(key, issue.kind)
  }
  return map
}

export interface CouponStatusInput {
  /** Aplicar ou remover em andamento. */
  submitting: boolean
  /** Código gravado no carrinho (`Cart.couponCode`). */
  couponCode: string | undefined
  quote: Pick<Quote, 'coupon'> | undefined
  quoteError: boolean
}

/**
 * Status do `CouponInput`. O `PUT /cart/coupon` só guarda o código: `applied`/`invalid`/`expired` só existe na
 * cotação feita com esse código. Enquanto a cotação ainda não trouxe o código gravado, é `applying`
 * (sem isso, o campo piscaria vazio entre o PUT e a cotação nova).
 */
export function couponStatus({ submitting, couponCode, quote, quoteError }: CouponStatusInput): CouponInputStatus {
  if (submitting) return 'applying'
  if (!couponCode) return 'idle'
  const coupon = quote?.coupon
  if (coupon && coupon.code.toUpperCase() === couponCode.toUpperCase()) return coupon.status satisfies CouponStatus
  return quoteError ? 'idle' : 'applying'
}

/** Nome acessível do link do carrinho: "Carrinho" ou "Carrinho, N itens" (soma das quantidades). */
export function cartLinkLabel(totalQuantity: number): string {
  if (totalQuantity <= 0) return 'Carrinho'
  return `Carrinho, ${totalQuantity} ${totalQuantity === 1 ? 'item' : 'itens'}`
}

export interface CheckoutGateInput {
  quote: Pick<Quote, 'issues'> | undefined
  /** A cotação mostrada é a anterior (chave nova ainda sendo buscada). */
  recalculating: boolean
  /** A última busca falhou. O React Query mantém `data` antigo nesse caso: não vale como cotação atual. */
  quoteError: boolean
}

/** Por que "Conectar e finalizar" (e o "Confirmar compra") está bloqueado pela cotação. */
export type CheckoutBlock = 'error' | 'loading' | 'recalculating' | 'issues'

/** Aviso da cotação com `issues` (indisponível ou preço alterado), no Carrinho e no Pagamento. */
export const QUOTE_ISSUES_MESSAGE = 'Há itens indisponíveis ou com preço alterado. Ajuste o carrinho para continuar.'

/** O motivo, em texto, ligado ao CTA bloqueado por `aria-describedby`. */
export const CHECKOUT_BLOCK_MESSAGE: Record<CheckoutBlock, string> = {
  error: 'Não foi possível calcular o total. Tente novamente para continuar.',
  loading: 'Calculando o total…',
  recalculating: 'Aguarde: os valores estão sendo recalculados.',
  issues: QUOTE_ISSUES_MESSAGE,
}

/** O que bloqueia o checkout pela cotação; `undefined` = cotação atual, sem recotação, sem erro e sem `issues`. */
export function checkoutBlock({ quote, recalculating, quoteError }: CheckoutGateInput): CheckoutBlock | undefined {
  if (quoteError) return 'error'
  if (quote === undefined) return 'loading'
  if (recalculating) return 'recalculating'
  if ((quote.issues?.length ?? 0) > 0) return 'issues'
  return undefined
}

/** "Conectar e finalizar" só com cotação atual: existe, sem recotação, sem erro de recotação e sem `issues`. */
export function canCheckout(input: CheckoutGateInput): boolean {
  return checkoutBlock(input) === undefined
}

/**
 * Visitante com a linha já no limite do estoque: nada foi adicionado. É o caso em que o logado recebe o 409
 * do servidor, e o aviso segue o mesmo caminho (painel ou toast).
 */
export function guestStockLimitMessage(available: number): string {
  if (!(available >= 1)) return 'Esta edição está esgotada.'
  const units = Math.floor(available)
  return units === 1
    ? 'Só resta 1 unidade desta edição, e ela já está no seu carrinho.'
    : `Só restam ${units} unidades desta edição, e todas já estão no seu carrinho.`
}

/**
 * Visitante que pediu mais do que coube: a linha ficou no `available` (`floor`), menos do que a soma pedida (ou
 * desceu até ele, com o estoque que caiu). Não é "Adicionado ao carrinho": segue o caminho do 409 do logado.
 */
export function guestPartialAddMessage(available: number): string {
  const units = Math.floor(available)
  return units === 1
    ? 'Só resta 1 unidade desta edição: seu carrinho ficou com 1.'
    : `Só restam ${units} unidades desta edição: seu carrinho ficou com ${units}.`
}

/** O que a linha do carrinho mostra e que o tempo real pode mudar. */
export interface LineSnapshot {
  unitPrice: EthAmount | undefined
  issue: QuoteIssue['kind'] | undefined
}

/**
 * Frase para a região `aria-live` quando a linha do carrinho aberto muda sem o usuário mexer nela (§7 e §8,
 * `nft.updated`): o preço exibido mudou (visitante: preço do catálogo; logado: o da cotação refeita) ou a cotação
 * passou a marcar a linha como "Preço alterado"/"Indisponível". A primeira vez que a linha tem preço não é
 * mudança; voltar ao normal também não é anunciado. Quantidade e cupom não mudam o `unitPrice`.
 */
export function lineChangeAnnouncement(name: string, prev: LineSnapshot, next: LineSnapshot): string | undefined {
  if (prev.unitPrice === undefined || next.unitPrice === undefined) return undefined
  if (next.issue === 'unavailable' && prev.issue !== 'unavailable') return `${name} ficou indisponível.`
  const priceMoved = !eqEth(prev.unitPrice, next.unitPrice)
  if (priceMoved || (next.issue === 'price_changed' && prev.issue !== 'price_changed')) return `O preço de ${name} mudou.`
  return undefined
}
