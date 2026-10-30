import { QueryClient } from '@tanstack/react-query'

// 30s de staleTime evita refetch a cada navegação; o tempo real atualizará preço e estoque (M4)
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})
