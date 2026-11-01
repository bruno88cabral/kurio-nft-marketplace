// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { navigateSpy, setSearch } from '@/test/routerMock'
import '@/test/render'
import { useCatalogSearch } from './useCatalogSearch'

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())

describe('useCatalogSearch', () => {
  it('lê o search da rota /', () => {
    setSearch({ q: 'sol', tab: 'new' })
    const { result } = renderHook(() => useCatalogSearch())
    expect(result.current.search).toEqual({ q: 'sol', tab: 'new' })
  })

  it('update navega sem resetar o scroll e volta à página 1', () => {
    const { result } = renderHook(() => useCatalogSearch())
    result.current.update({ sort: 'price_asc' })
    expect(navigateSpy).toHaveBeenCalledTimes(1)
    const arg = navigateSpy.mock.calls[0][0] as unknown as { search: (p: unknown) => unknown; resetScroll: boolean }
    expect(arg.resetScroll).toBe(false)
    expect(arg.search({ q: 'sol', page: 4, sort: 'newest' })).toMatchObject({ q: 'sol', sort: 'price_asc', page: undefined })
  })

  it('update mantém a identidade entre renders', () => {
    const { result, rerender } = renderHook(() => useCatalogSearch())
    const first = result.current.update
    rerender()
    expect(result.current.update).toBe(first)
  })
})
