import { keepPreviousData, useQuery, type QueryObserverResult } from '@tanstack/react-query'
import { quoteQuery } from '@/api/quotes'
import type { Cart, CartItem, EthAmount, Id, Quote, QuoteIssue } from '@/contracts'
import { useQueryInvalidated } from '@/realtime/useQueryInvalidated'
import { canCheckout, issuesByLine, lineKey } from './cartView'

/** Título do erro sem cotação nenhuma (o resumo some e entra o `ErrorState`). */
export const QUOTE_ERROR_TITLE = 'Não foi possível calcular o total.'
/** Aviso da cotação com `issues` (indisponível ou preço alterado), no Carrinho e no Pagamento. */
export const QUOTE_ISSUES_MESSAGE = 'Há itens indisponíveis ou com preço alterado. Ajuste o carrinho para continuar.'

export interface CartQuote {
  /** A cotação na tela: a atual, a anterior enquanto recota (`keepPreviousData`) ou a antiga depois de um erro. */
  quote: Quote | undefined
  /**
   * Recotando: chave nova ainda sendo buscada (a anterior é placeholder) ou a mesma chave invalidada
   * (ex.: `nft.updated` de um item do carrinho, MYK-1091) com a resposta nova a caminho.
   */
  recalculating: boolean
  /** A cotação na tela é a da chave anterior (`keepPreviousData`). */
  isPlaceholderData: boolean
  /** A última busca falhou. */
  isError: boolean
  isFetching: boolean
  /** Recotação falhou mas há cotação antiga (que vai vencer): aparece como desatualizada, com retry. */
  staleAfterError: boolean
  /** Divergências por linha (`nftId:edition`). */
  issues: Map<string, QuoteIssue['kind']>
  hasIssues: boolean
  /** Cotação atual, sem recotação, sem erro e sem `issues` (`canCheckout`). */
  canCheckout: boolean
  /** `unitPrice` da linha na cotação (nunca multiplicado); `undefined` se a cotação não tem a linha. */
  unitPriceOf: (item: Pick<CartItem, 'nftId' | 'edition'>) => EthAmount | undefined
  /** Recota a mesma chave; devolve o resultado da query (o Pagamento lê `data`/`error`). */
  refetch: () => Promise<QueryObserverResult<Quote>>
}

/**
 * Estado derivado da cotação do carrinho, o mesmo no Carrinho e no Pagamento: `quoteQuery` com
 * `keepPreviousData` (a anterior segue na tela, marcada como desatualizada) somado ao `useQueryInvalidated`.
 * Sem conta (visitante) ou sem itens a query fica desligada. Nenhum valor é somado aqui.
 */
export function useCartQuote(accountId: Id | undefined, cart: Cart): CartQuote {
  const options = quoteQuery(accountId ?? '', cart)
  const query = useQuery({
    ...options,
    enabled: accountId !== undefined && cart.items.length > 0,
    placeholderData: keepPreviousData,
  })
  const invalidated = useQueryInvalidated(options.queryKey)

  const quote = query.data
  const recalculating = query.isPlaceholderData || (invalidated && query.isFetching)
  const issues = issuesByLine(quote?.issues)
  return {
    quote,
    recalculating,
    isPlaceholderData: query.isPlaceholderData,
    isError: query.isError,
    isFetching: query.isFetching,
    staleAfterError: query.isError && quote !== undefined,
    issues,
    hasIssues: issues.size > 0,
    canCheckout: canCheckout({ quote, recalculating, quoteError: query.isError }),
    unitPriceOf: (item) => {
      const key = lineKey(item)
      return quote?.items.find((line) => lineKey(line) === key)?.unitPrice
    },
    refetch: () => query.refetch(),
  }
}
