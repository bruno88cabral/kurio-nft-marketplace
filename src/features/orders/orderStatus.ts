import type { QueryClient } from '@tanstack/react-query'
import { cartKeys } from '@/api/cart'
import { nftKeys } from '@/api/nfts'
import type { Id, Order } from '@/contracts'
import { settleCheckoutDraft, type CheckoutDraftStore } from '@/features/checkout/checkoutDraft'

/** Intervalo do polling do pedido `pending` (R-4). */
export const ORDER_POLL_MS = 3_000

/**
 * `refetchInterval` de `orderQuery` na Confirmação: 3 s enquanto `pending` **e** com o socket fora
 * (`socket.connected === false`); para no estado final. Com o socket conectado quem traz a mudança é o
 * `order.updated` (MYK-1091). A Confirmação passa `useSocketConnected()`, então cair ou voltar com a tela
 * aberta liga ou desliga o polling.
 */
export function orderRefetchInterval(order: Pick<Order, 'status'> | undefined, socketConnected: boolean): number | false {
  return order?.status === 'pending' && !socketConnected ? ORDER_POLL_MS : false
}

/**
 * Efeitos do estado final do pedido, idempotentes (rodar de novo não faz mal):
 * - `confirmed`: o servidor baixou o estoque e tirou do carrinho **só** o comprado. Invalida
 *   `['cart', id]` (prefixo: as cotações do carrinho também) e o detalhe de cada NFT comprado.
 * - o rascunho vai por `settleCheckoutDraft`: `confirmed` o limpa, `declined` tira só a tentativa, e só se o
 *   pedido for o da tentativa guardada (abrir um pedido antigo não apaga a atual).
 * Roda na Confirmação e no checkout (tentativa com `orderId` já final). O `order.updated` aplica a parte do
 * rascunho sozinho (`applyOrderUpdated`), então a Confirmação fechada não deixa o rascunho preso.
 */
export function applyOrderOutcome(queryClient: QueryClient, accountId: Id, order: Order, drafts: CheckoutDraftStore) {
  if (order.status === 'pending') return
  if (order.status === 'confirmed') {
    void queryClient.invalidateQueries({ queryKey: cartKeys.detail(accountId) })
    for (const nftId of new Set(order.items.map((i) => i.nftId))) {
      void queryClient.invalidateQueries({ queryKey: nftKeys.detail(nftId) })
    }
  }
  settleCheckoutDraft(drafts, order)
}
