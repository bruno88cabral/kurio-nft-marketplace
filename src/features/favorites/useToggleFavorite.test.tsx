// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { favoriteKeys } from '@/api/favorites'
import { ApiError, type Favorite } from '@/contracts'
import { createTestQueryClient } from '@/test/render'
import { navigateSpy, setLocation } from '@/test/routerMock'
import { ANA, sessionOf } from '@/test/session'
import { bumpSession } from '@/test/sessionGuardMock'
import {
  FAVORITE_ADDED_MESSAGE,
  FAVORITE_FAILURE_MESSAGE,
  FAVORITE_REMOVED_MESSAGE,
  useToggleFavorite,
} from './useToggleFavorite'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  error: vi.fn(),
  announce: vi.fn(),
  session: ((): { current: unknown } => ({ current: null }))(),
}))
vi.mock('@/api/client', () => ({ apiClient: { get: mocks.get, put: mocks.put, delete: mocks.del } }))
vi.mock('@/auth/useSession', () => ({ useSession: () => mocks.session.current }))
vi.mock('sonner', () => ({ toast: { error: mocks.error } }))
// O resultado vai para a região aria-live única do app (LiveAnnouncer): aqui só a chamada
vi.mock('@/lib/announcer', () => ({ announce: mocks.announce }))
vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
vi.mock('@/auth/sessionGuard', async () => (await import('@/test/sessionGuardMock')).sessionGuardMock())

const fav = (nftId: string): Favorite => ({ nftId, createdAt: '2026-01-01T00:00:00.000Z' })
const listOf = (items: Favorite[]) => mocks.get.mockResolvedValue({ data: items })

function setup(nftId = 'nft-1') {
  const queryClient = createTestQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  return { queryClient, ...renderHook(() => useToggleFavorite(nftId), { wrapper }) }
}

function deferred() {
  let resolve!: () => void
  let reject!: (e: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  for (const m of [mocks.get, mocks.put, mocks.del, mocks.error, mocks.announce]) m.mockReset()
  mocks.put.mockResolvedValue({})
  mocks.del.mockResolvedValue({})
  mocks.session.current = sessionOf(ANA)
})

describe('useToggleFavorite', () => {
  it('visitante: não favorita, não consulta a lista e o toggle manda para /login com redirect', () => {
    mocks.session.current = sessionOf(null)
    setLocation({ href: '/nfts/nft-1?edition=open' })
    const { result } = setup()
    expect(result.current.favorited).toBe(false)
    expect(result.current.pending).toBe(false)
    act(() => result.current.toggle())
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/login', search: { redirect: '/nfts/nft-1?edition=open' } })
    expect(mocks.get).not.toHaveBeenCalled()
    expect(mocks.put).not.toHaveBeenCalled()
  })

  it('sessão sendo confirmada: pending e o toggle não faz nada', () => {
    mocks.session.current = { account: undefined, isAuthenticated: false, isPending: true }
    const { result } = setup()
    expect(result.current.pending).toBe(true)
    act(() => result.current.toggle())
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('logado com a lista ainda chegando: pending e o toggle não faz nada', () => {
    mocks.get.mockImplementation(() => new Promise(() => {}))
    const { result } = setup()
    expect(result.current.pending).toBe(true)
    act(() => result.current.toggle())
    expect(mocks.put).not.toHaveBeenCalled()
  })

  it('logado: reflete a lista da conta e favorita de forma otimista, anunciando o resultado', async () => {
    listOf([fav('nft-9')])
    const { result, queryClient } = setup()
    await waitFor(() => expect(result.current.pending).toBe(false))
    expect(result.current.favorited).toBe(false)
    const gate = deferred()
    mocks.put.mockReturnValue(gate.promise)
    act(() => result.current.toggle())
    await waitFor(() => expect(result.current.favorited).toBe(true))
    expect(queryClient.getQueryData<Favorite[]>(favoriteKeys.list(ANA.id))?.map((f) => f.nftId)).toEqual(['nft-9', 'nft-1'])
    expect(mocks.announce).not.toHaveBeenCalled()
    gate.resolve()
    await waitFor(() => expect(mocks.announce).toHaveBeenCalledWith(FAVORITE_ADDED_MESSAGE))
    expect(mocks.put).toHaveBeenCalledWith('/favorites/nft-1')
  })

  it('logado: já favoritado, o toggle remove e anuncia', async () => {
    listOf([fav('nft-1')])
    const { result } = setup()
    await waitFor(() => expect(result.current.favorited).toBe(true))
    listOf([])
    act(() => result.current.toggle())
    await waitFor(() => expect(mocks.announce).toHaveBeenCalledWith(FAVORITE_REMOVED_MESSAGE))
    expect(mocks.del).toHaveBeenCalledWith('/favorites/nft-1')
    await waitFor(() => expect(result.current.favorited).toBe(false))
  })

  it('falha: desfaz o otimista e mostra o toast, sem anúncio', async () => {
    listOf([])
    const { result, queryClient } = setup()
    await waitFor(() => expect(result.current.pending).toBe(false))
    const gate = deferred()
    mocks.put.mockReturnValue(gate.promise)
    act(() => result.current.toggle())
    await waitFor(() => expect(result.current.favorited).toBe(true))
    gate.reject(new ApiError({ code: 'transient', message: 'x' }, 500))
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(FAVORITE_FAILURE_MESSAGE))
    await waitFor(() => expect(result.current.favorited).toBe(false))
    expect(mocks.announce).not.toHaveBeenCalled()
    expect(queryClient.isMutating()).toBe(0)
  })

  it('401 não mostra o toast (o ciclo de vida da sessão já avisa), mas desfaz', async () => {
    listOf([])
    const { result, queryClient } = setup()
    await waitFor(() => expect(result.current.pending).toBe(false))
    mocks.put.mockRejectedValue(new ApiError({ code: 'unauthorized', message: 'x' }, 401))
    act(() => result.current.toggle())
    await waitFor(() => expect(result.current.favorited).toBe(false))
    await waitFor(() => expect(queryClient.isMutating()).toBe(0))
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it('sessão trocada com a request em voo: sucesso não anuncia', async () => {
    listOf([])
    const { result, queryClient } = setup()
    await waitFor(() => expect(result.current.pending).toBe(false))
    const gate = deferred()
    mocks.put.mockReturnValue(gate.promise)
    act(() => result.current.toggle())
    await waitFor(() => expect(mocks.put).toHaveBeenCalled())
    bumpSession()
    gate.resolve()
    await waitFor(() => expect(queryClient.isMutating()).toBe(0))
    expect(mocks.get).toHaveBeenCalledTimes(1) // sem invalidação: a lista é da sessão anterior
    expect(mocks.announce).not.toHaveBeenCalled()
  })

  it('sessão trocada com a request em voo: falha não anuncia nem mostra toast', async () => {
    listOf([])
    const { result, queryClient } = setup()
    await waitFor(() => expect(result.current.pending).toBe(false))
    const gate = deferred()
    mocks.put.mockReturnValue(gate.promise)
    act(() => result.current.toggle())
    await waitFor(() => expect(mocks.put).toHaveBeenCalled())
    bumpSession()
    gate.reject(new ApiError({ code: 'transient', message: 'x' }, 500))
    await waitFor(() => expect(queryClient.isMutating()).toBe(0))
    expect(mocks.get).toHaveBeenCalledTimes(1) // sem invalidação: a lista é da sessão anterior
    expect(mocks.error).not.toHaveBeenCalled()
    expect(mocks.announce).not.toHaveBeenCalled()
  })
})
