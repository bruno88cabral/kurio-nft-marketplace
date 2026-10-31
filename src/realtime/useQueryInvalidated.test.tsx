// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
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
    // O aviso ao React sai em lote (`notifyManager.batchCalls`), depois do tick
    await waitFor(() => expect(result.current).toBe(true))

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

  it('uma query criada no render de outro componente não gera "Cannot update a component while rendering"', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    function Watcher() {
      useQueryInvalidated(KEY)
      return null
    }
    // Cria a query no render (o `useQuery` de uma chave nova faz `QueryCache.add` e notifica os assinantes)
    function Detail({ id }: { id: string }) {
      useQuery({ queryKey: ['nfts', 'detail', id], queryFn: () => new Promise<string>(() => undefined) })
      return null
    }
    let show: (ids: string[]) => void = () => undefined
    function Page() {
      const [ids, setIds] = useState<string[]>([])
      show = setIds
      return (
        <>
          <Watcher />
          {ids.map((id) => (
            <Detail key={id} id={id} />
          ))}
        </>
      )
    }
    render(
      <QueryClientProvider client={queryClient}>
        <Page />
      </QueryClientProvider>,
    )
    queryClient.setQueryData(KEY, 'v1')
    // No mesmo tick: a cotação é invalidada (o `Watcher` agenda um render) e a lista ganha NFTs novos. No render,
    // o `Watcher` vem antes e as queries novas nascem depois, enquanto o valor dele ainda não foi confirmado
    act(() => {
      void queryClient.invalidateQueries({ queryKey: KEY })
      show(['nft-001', 'nft-002'])
    })
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(3))
    const warnings = error.mock.calls.filter((args) => String(args[0]).includes('Cannot update a component'))
    error.mockRestore()
    expect(warnings).toEqual([])
  })
})
