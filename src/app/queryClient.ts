import { QueryClient } from '@tanstack/react-query'

// 30s de staleTime evita refetch a cada navegação; o tempo real atualiza preço e estoque pelos eventos do
// socket (ver "Reconciliação" no ARCHITECTURE.md)
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})
