import { ErrorState } from '@/components/kurio'
import { QUOTE_ERROR_TITLE, type CartQuote } from './useCartQuote'

/** Erro sem cotação nenhuma, no lugar do resumo (Carrinho e Pagamento): "Tentar novamente" recota. */
export function QuoteErrorState({ quote }: { quote: Pick<CartQuote, 'refetch' | 'isFetching'> }) {
  return (
    <ErrorState title={QUOTE_ERROR_TITLE} onRetry={() => void quote.refetch()} retrying={quote.isFetching} className="px-3 py-6" />
  )
}
