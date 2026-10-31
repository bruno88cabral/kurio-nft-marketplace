import type { QueryClient } from '@tanstack/react-query'
import { cartKeys } from '@/api/cart'
import { nftKeys } from '@/api/nfts'
import { orderKeys } from '@/api/orders'
import { SESSION_QUERY_KEY } from '@/auth/useSession'
import type { Id, Nft, NftUpdatedEvent, Order, OrderUpdatedEvent, Paginated, Quote, Session } from '@/contracts'
import { eqEth } from '@/lib/eth'

/** Prefixo de todas as listas do catálogo (`nftKeys.list(params)`), qualquer filtro ou página. */
const NFT_LISTS = [...nftKeys.all, 'list'] as const

/** Raízes refeitas depois de uma reconexão por queda: o que chegou enquanto o socket estava fora se perdeu. */
export const RECONNECT_ROOTS = [nftKeys.all, cartKeys.all, orderKeys.all] as const

function sessionAccountId(queryClient: QueryClient): Id | undefined {
  return queryClient.getQueryData<Session>(SESSION_QUERY_KEY)?.account.id
}

/**
 * `true` se o NFT está na cotação e o evento a desmente: o `unitPrice` congelado não é mais o preço, ou a
 * disponibilidade da edição mudou de lado (a cotação marcou `unavailable` e agora há estoque, ou o contrário).
 * NFT fora da cotação: `false` (a cotação não depende dele).
 */
export function quoteDivergesFrom(quote: Quote, nft: NftUpdatedEvent['payload']): boolean {
  return quote.items.some((line) => {
    if (line.nftId !== nft.id) return false
    if (!eqEth(line.unitPrice, nft.price)) return true
    const edition = nft.editions.find((e) => e.kind === line.edition)
    const availableNow = edition !== undefined && edition.available >= line.quantity
    const flaggedUnavailable =
      quote.issues?.some((i) => i.kind === 'unavailable' && i.nftId === line.nftId && i.edition === line.edition) ?? false
    return availableNow === flaggedUnavailable
  })
}

/**
 * `nft.updated` (todas as conexões): troca `price` e `editions` onde o NFT já está no cache, sem refetch em massa
 * e sem mutar (objeto novo). Detalhe, listas (qualquer filtro) e destaques; as facetas não mudam (o preço mínimo
 * e o máximo ficam defasados até o próximo fetch). Logado, se a cotação do carrinho tem o NFT e diverge, ela é
 * invalidada: o resumo vira `stale` ("Recalculando…") e recota.
 */
export function applyNftUpdated(queryClient: QueryClient, event: NftUpdatedEvent): void {
  const { payload } = event
  const patch = (nft: Nft): Nft => ({ ...nft, price: payload.price, editions: payload.editions })
  const patchItems = (items: Nft[]) => items.map((nft) => (nft.id === payload.id ? patch(nft) : nft))
  const contains = (items: Nft[] | undefined) => items?.some((nft) => nft.id === payload.id) ?? false

  queryClient.setQueryData<Nft>(nftKeys.detail(payload.id), (old) => old && patch(old))

  // Só as listas que têm o NFT: `setQueryData` renova o `dataUpdatedAt`, e as outras não mudaram
  for (const [key, page] of queryClient.getQueriesData<Paginated<Nft>>({ queryKey: NFT_LISTS })) {
    if (page && contains(page.items)) queryClient.setQueryData<Paginated<Nft>>(key, { ...page, items: patchItems(page.items) })
  }
  const featured = queryClient.getQueryData<Nft[]>(nftKeys.featured)
  if (contains(featured)) queryClient.setQueryData<Nft[]>(nftKeys.featured, patchItems(featured ?? []))

  const accountId = sessionAccountId(queryClient)
  if (accountId === undefined) return
  const quotes = queryClient.getQueriesData<Quote>({ queryKey: [...cartKeys.detail(accountId), 'quote'] })
  if (quotes.some(([, quote]) => quote !== undefined && quoteDivergesFrom(quote, payload))) {
    void queryClient.invalidateQueries({ queryKey: [...cartKeys.detail(accountId), 'quote'] })
  }
}

/**
 * `order.updated` (só o dono): põe o `status` no pedido em cache e o refaz para trazer `txHash`/`explorerUrl`.
 * O pedido só é tocado se a query já existe no cache da conta da sessão: nunca cria chave (nem de outra conta).
 * `refetchType: 'all'` refaz também o pedido sem observer (Confirmação fechada, ou o `ensureQueryData` do loader
 * em voo, cuja resposta poderia ser anterior ao evento e apagar a invalidação).
 * No `confirmed` o servidor tirou o comprado do carrinho: invalida `['cart', id]` (inclui as cotações).
 * Os efeitos de rascunho e de detalhe do NFT ficam com `applyOrderOutcome`, na Confirmação.
 */
export function applyOrderUpdated(queryClient: QueryClient, event: OrderUpdatedEvent): void {
  const accountId = sessionAccountId(queryClient)
  if (accountId === undefined) return
  const { id, status } = event.payload
  const key = orderKeys.detail(accountId, id)
  // A query pode existir sem dado (primeiro fetch em voo): a invalidação cancela e refaz a request
  if (queryClient.getQueryCache().find({ queryKey: key, exact: true }) !== undefined) {
    queryClient.setQueryData<Order>(key, (order) => (order && order.status !== status ? { ...order, status } : order))
    void queryClient.invalidateQueries({ queryKey: key, exact: true, refetchType: 'all' })
  }
  if (status === 'confirmed') void queryClient.invalidateQueries({ queryKey: cartKeys.detail(accountId) })
}

/** Reconexão por queda: refaz catálogo, carrinho e pedidos ativos (os inativos só ficam marcados). */
export function invalidateAfterReconnect(queryClient: QueryClient): Promise<void[]> {
  return Promise.all(RECONNECT_ROOTS.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}
