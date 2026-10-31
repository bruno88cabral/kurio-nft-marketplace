import type { QueryClient } from '@tanstack/react-query'
import { cartKeys } from '@/api/cart'
import { nftKeys } from '@/api/nfts'
import type { Id, Order } from '@/contracts'
import { withoutOrderKey, type CheckoutDraftStore } from '@/features/checkout/checkoutDraft'

/** Intervalo do polling do pedido `pending` (R-4). */
export const ORDER_POLL_MS = 3_000

/**
 * `refetchInterval` de `orderQuery` na Confirmação: 3 s enquanto `pending`, e para no estado final.
 * Ponto único de troca para a MYK-1091 (tempo real), que passa a pollar só com o socket caído.
 */
export function orderRefetchInterval(order: Pick<Order, 'status'> | undefined): number | false {
  return order?.status === 'pending' ? ORDER_POLL_MS : false
}

/**
 * Efeitos do estado final do pedido, idempotentes (rodar de novo não faz mal):
 * - `confirmed`: o servidor baixou o estoque e tirou do carrinho **só** o comprado. Invalida
 *   `['cart', id]` (prefixo: as cotações do carrinho também) e o detalhe de cada NFT comprado, e limpa o rascunho.
 * - `declined`: a cotação pode ser reusada, mas a chave não: tira a tentativa do rascunho (carteira fica).
 * O rascunho só é tocado se a tentativa guardada for a deste pedido (abrir um pedido antigo não apaga a atual).
 */
export function applyOrderOutcome(queryClient: QueryClient, accountId: Id, order: Order, drafts: CheckoutDraftStore) {
  if (order.status === 'pending') return
  const draft = drafts.get()
  const ownsDraft = draft.idempotencyKey === order.idempotencyKey
  if (order.status === 'confirmed') {
    void queryClient.invalidateQueries({ queryKey: cartKeys.detail(accountId) })
    for (const nftId of new Set(order.items.map((i) => i.nftId))) {
      void queryClient.invalidateQueries({ queryKey: nftKeys.detail(nftId) })
    }
    if (ownsDraft) drafts.clear()
  } else if (ownsDraft) {
    drafts.set(withoutOrderKey(draft))
  }
}
