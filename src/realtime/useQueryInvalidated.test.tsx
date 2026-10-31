// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useQueryInvalidated } from './useQueryInvalidated'

const KEY = ['cart', 'user-ana', 'quote', 'fp'] as const

describe('useQueryInvalidated', () => {
  it('liga na invalidação e desliga quando a resposta nova chega; outra chave não interfere', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    let resolve: (value: string) => void = () => undefined
    queryClient.setQueryData(KEY, 'v1')
    queryClient.getQueryCache().find({ queryKey: KEY })?.setOptions({
      queryKey: KEY,
      queryFn: () => new Promise<string>((r) => (resolve = r)),
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useQueryInvalidated(KEY), { wrapper })
    expect(result.current).toBe(false)

    act(() => void queryClient.invalidateQueries({ queryKey: ['cart', 'user-ana', 'other'] }))
    expect(result.current).toBe(false)

    // Sem observer a invalidação não refaz: o fetch é disparado à mão, como o observer da tela faria
    act(() => {
      void queryClient.invalidateQueries({ queryKey: ['cart', 'user-ana', 'quote'] })
      void queryClient.refetchQueries({ queryKey: KEY })
    })
    expect(result.current).toBe(true)

    act(() => resolve('v2'))
    await waitFor(() => expect(result.current).toBe(false))
    expect(queryClient.getQueryData(KEY)).toBe('v2')
  })

  it('chave fora do cache: false', () => {
    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useQueryInvalidated(['cart', 'x', 'quote', 'y']), { wrapper })
    expect(result.current).toBe(false)
  })
})
