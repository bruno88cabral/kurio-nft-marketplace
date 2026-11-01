import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { createOrder } from '@/api/orders'
import { walletKeys } from '@/api/wallets'
import { captureSession } from '@/auth/sessionGuard'
import { ApiError, type CartItem, type Id, type Quote } from '@/contracts'
import type { CartQuote } from '@/features/cart/useCartQuote'
import type { CheckoutDraft } from './checkoutDraft'
import {
  confirmPurchase,
  ORDER_FAILED_MESSAGE,
  resendPendingOrder,
  type ConfirmPurchaseInput,
  type PlaceOrderDeps,
  type PlaceOrderOutcome,
} from './placeOrder'
import { reviewSource, type ReviewSource } from './reviewSource'
import { diffSnapshots, snapshotOf, type ReviewSnapshot, type SnapshotChange } from './reviewSnapshot'
import { useCheckoutDraft } from './useCheckoutDraft'

/** O resultado que a tela trata: `created` já navegou e `stale-session` não mostra nada (`usePlaceOrder`). */
export type SettledOutcome = Exclude<PlaceOrderOutcome, { kind: 'created' } | { kind: 'stale-session' }>
export type OutcomeHandler = (outcome: SettledOutcome) => void | Promise<void>

export interface PlaceOrder {
  /** Um envio em voo (confirmação ou reenvio). Fica `true` depois do `created`, até a página sair. */
  submitting: boolean
  /** O envio em voo é um "Tentar de novo". */
  resending: boolean
  /** "Confirmar compra": recota, compara com o revisado e envia (`confirmPurchase`). */
  confirm: (input: ConfirmPurchaseInput, onSettled: OutcomeHandler) => void
  /** "Tentar de novo": a mesma chave e o mesmo corpo da tentativa gravada (`resendPendingOrder`). */
  resend: (onSettled: OutcomeHandler) => void
}

/**
 * O envio do pedido, comum ao Pagamento e ao "Tentar de novo" do carrinho vazio. Trava síncrona com `useRef`
 * (dois cliques no mesmo tick não passam pelo estado ainda não renderizado), navegação para a Confirmação no
 * `created` (a trava fica até a página sair, para não haver segundo envio) e descarte do `stale-session`. O
 * resto do resultado vai para `onSettled`, que decide a apresentação (aviso na tela ou toast).
 */
export function usePlaceOrder(accountId: Id): PlaceOrder {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { store: drafts } = useCheckoutDraft(accountId)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const lock = useRef(false)

  // A sessão é capturada no clique: o resultado de outra sessão vira `stale-session`
  const deps = (): PlaceOrderDeps => ({ queryClient, accountId, drafts, createOrder, sameSession: captureSession() })

  const run = async (action: () => Promise<PlaceOrderOutcome | undefined>, onSettled: OutcomeHandler) => {
    if (lock.current) return
    lock.current = true
    setSubmitting(true)
    let navigated = false
    try {
      const outcome = await action()
      if (!outcome || outcome.kind === 'stale-session') return
      if (outcome.kind === 'created') {
        navigated = true
        // O pedido já está no cache: a Confirmação abre sem esperar; `replace` tira o Pagamento do Voltar
        await navigate({ to: '/orders/$orderId', params: { orderId: outcome.order.id }, replace: true })
        return
      }
      await onSettled(outcome)
    } finally {
      // Depois do sucesso a página sai; a trava fica até lá para não haver segundo envio
      if (!navigated) {
        lock.current = false
        setSubmitting(false)
      }
    }
  }

  return {
    submitting,
    resending,
    confirm: (input, onSettled) => void run(() => confirmPurchase(deps(), input), onSettled),
    resend: (onSettled) => {
      if (lock.current) return
      setResending(true)
      void run(() => resendPendingOrder(deps()), onSettled).finally(() => setResending(false))
    },
  }
}

/** O que a última tentativa deixou para a tela (a falha transitória vem do rascunho, não daqui). */
export type Notice =
  | { kind: 'changed'; changes: SnapshotChange[] }
  | { kind: 'items'; fieldErrors: Record<string, string> }
  | { kind: 'quote'; message: string }
  | { kind: 'blocked' }
  | { kind: 'requote-failed' }
  | { kind: 'fatal'; message: string }

export interface CheckoutOrder extends Pick<PlaceOrder, 'submitting' | 'resending'> {
  /** O que a Revisão e o resumo mostram (tentativa ou carrinho). */
  source: ReviewSource
  /** O snapshot revisado: o que a tela mostrou (R3). `undefined` até a primeira cotação do carrinho aparecer. */
  reviewed: ReviewSnapshot | undefined
  notice: Notice | undefined
  /** "Confirmar compra" com a carteira escolhida; sem revisado não faz nada. */
  confirm: (walletId: Id) => void
  /**
   * Abrir a revisão em diálogo (MYK-1120, R-23): compara a cotação na tela com o revisado (`diffSnapshots`, a mesma
   * comparação do R3) e devolve as diferenças, que o diálogo mostra ("Os valores mudaram desde a revisão anterior."
   * com o diff). Só então a cotação na tela passa a ser o revisado. Sem diferença nada muda e a lista vem vazia.
   * Só com o carrinho na tela e uma cotação atual; o "Confirmar" seguinte ainda recota e compara com ela (R3).
   */
  markReviewed: () => SnapshotChange[]
  /** "Tentar de novo" da tentativa pendente. */
  resend: () => void
}

/**
 * O envio no Pagamento com carrinho: `usePlaceOrder` mais o revisado, a origem da Revisão e o aviso de cada
 * resultado na tela (`notice`).
 */
export function useCheckoutOrder({
  accountId,
  cartItems,
  draft,
  quote,
}: {
  accountId: Id
  cartItems: readonly CartItem[]
  draft: CheckoutDraft
  quote: CartQuote
}): CheckoutOrder {
  const queryClient = useQueryClient()
  const order = usePlaceOrder(accountId)
  const { submitting, resending } = order

  // Com tentativa pendente (e snapshot), a Revisão e o resumo mostram o que "Tentar de novo" compra. Durante o
  // "Confirmando…" o `withOrderKey` já gravou a tentativa antes do POST: a Revisão fica no carrinho (só exibição,
  // nada do que é enviado muda) até o envio terminar. O reenvio ("Tentar de novo") já mostra a tentativa.
  const source: ReviewSource = !submitting || resending ? reviewSource(cartItems, draft) : { kind: 'cart', items: cartItems }

  // O revisado: a primeira cotação mostrada, e depois só o que a tela mostrou ao avisar de uma mudança (no envio ou
  // no diálogo de revisão, `markReviewed`). Com a
  // tentativa na Revisão, a cotação do carrinho não está na tela: nada é revisado; quando a origem muda, o revisado
  // recomeça (o próximo "Confirmar" compara com o que foi exibido)
  const [reviewed, setReviewed] = useState<ReviewSnapshot>()
  const [reviewedSource, setReviewedSource] = useState(source.kind)
  if (reviewedSource !== source.kind) {
    setReviewedSource(source.kind)
    setReviewed(undefined)
  } else if (!reviewed && source.kind === 'cart' && quote.quote && !quote.isPlaceholderData) {
    setReviewed(snapshotOf(quote.quote))
  }

  const [notice, setNotice] = useState<Notice>()

  const requote = async (): Promise<Quote> => {
    const result = await quote.refetch()
    if (result.isError || !result.data) throw result.error ?? new Error('Cotação indisponível.')
    return result.data
  }

  const handle = async (outcome: SettledOutcome) => {
    switch (outcome.kind) {
      case 'changed':
        setReviewed(outcome.snapshot)
        setNotice({ kind: 'changed', changes: outcome.changes })
        return
      case 'blocked':
        setReviewed(outcome.snapshot)
        setNotice({ kind: 'blocked' })
        return
      case 'requote-failed':
        setNotice({ kind: 'requote-failed' })
        return
      case 'transient':
        // A tentativa ficou no rascunho: o aviso com "Tentar de novo" aparece por ela
        setNotice(undefined)
        return
      case 'fatal':
        // A tentativa já saiu do rascunho: o CTA volta e a carteira destrava. A lista pode ter mudado
        // (carteira removida em outra aba): recarrega para o usuário escolher outra
        void queryClient.invalidateQueries({ queryKey: walletKeys.list(accountId) })
        setNotice({
          kind: 'fatal',
          message: outcome.error instanceof ApiError ? outcome.error.message : ORDER_FAILED_MESSAGE,
        })
        return
      case 'items':
      case 'quote': {
        setNotice(
          outcome.kind === 'items'
            ? { kind: 'items', fieldErrors: outcome.fieldErrors }
            : { kind: 'quote', message: outcome.message },
        )
        // A chave foi descartada: recota para a tela mostrar os valores atuais, que passam a ser o revisado
        try {
          setReviewed(snapshotOf(await requote()))
        } catch {
          // A cotação antiga segue na tela; o próximo clique recota de novo
        }
        return
      }
    }
  }

  return {
    submitting,
    resending,
    source,
    reviewed,
    notice,
    confirm: (walletId) => {
      if (!reviewed) return
      setNotice(undefined)
      order.confirm({ reviewed, walletId, requote }, handle)
    },
    markReviewed: () => {
      if (source.kind !== 'cart' || !quote.quote || quote.isPlaceholderData) return []
      const shown = snapshotOf(quote.quote)
      if (!reviewed) {
        setReviewed(shown)
        return []
      }
      const changes = diffSnapshots(reviewed, shown)
      // Uma mudança em segundo plano (evento, intervalo, cupom) antes da revisão não é engolida: o diálogo a mostra
      if (changes.length > 0) setReviewed(shown)
      return changes
    },
    resend: () => order.resend(handle),
  }
}
