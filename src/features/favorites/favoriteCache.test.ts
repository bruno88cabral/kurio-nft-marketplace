import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { ApiError, type Favorite } from '@/contracts'
import { applyFavoriteToggle, favoriteMutationOptions, isFavorited, shouldToastFavoriteFailure } from './favoriteCache'

const NOW = '2026-10-31T12:00:00.000Z'
const fav = (nftId: string, createdAt = '2026-10-01T00:00:00.000Z'): Favorite => ({ nftId, createdAt })

describe('applyFavoriteToggle', () => {
  it('adiciona com a data informada', () => {
    expect(applyFavoriteToggle([fav('a')], 'b', true, NOW)).toEqual([fav('a'), fav('b', NOW)])
  })

  it('remove', () => {
    expect(applyFavoriteToggle([fav('a'), fav('b')], 'a', false, NOW)).toEqual([fav('b')])
  })

  it('é idempotente (adicionar o que já está, remover o que não está)', () => {
    const list = [fav('a')]
    expect(applyFavoriteToggle(list, 'a', true, NOW)).toBe(list)
    expect(applyFavoriteToggle(list, 'z', false, NOW)).toBe(list)
  })

  it('lista ausente vira lista vazia', () => {
    expect(applyFavoriteToggle(undefined, 'a', true, NOW)).toEqual([fav('a', NOW)])
    expect(applyFavoriteToggle(undefined, 'a', false, NOW)).toEqual([])
  })

  it('não muta a lista recebida', () => {
    const list = [fav('a')]
    applyFavoriteToggle(list, 'b', true, NOW)
    applyFavoriteToggle(list, 'a', false, NOW)
    expect(list).toEqual([fav('a')])
  })
})

describe('isFavorited', () => {
  it('procura pelo nftId', () => {
    expect(isFavorited([fav('a')], 'a')).toBe(true)
    expect(isFavorited([fav('a')], 'b')).toBe(false)
    expect(isFavorited(undefined, 'a')).toBe(false)
  })
})

describe('shouldToastFavoriteFailure', () => {
  it('401 não mostra o toast genérico (o de sessão expirada já aparece)', () => {
    expect(shouldToastFavoriteFailure(new ApiError({ code: 'unauthorized', message: 'x' }, 401))).toBe(false)
  })

  it('outras falhas mostram', () => {
    expect(shouldToastFavoriteFailure(new ApiError({ code: 'transient', message: 'x' }, 503))).toBe(true)
    expect(shouldToastFavoriteFailure(new ApiError({ code: 'not_found', message: 'x' }, 404))).toBe(true)
    expect(shouldToastFavoriteFailure(new Error('x'))).toBe(true)
  })
})

describe('favoriteMutationOptions (QueryClient real em memória)', () => {
  const KEY = ['favorites', 'acc-1']

  function setup(request: (nftId: string, on: boolean) => Promise<void>) {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const snapshot = [fav('a')]
    queryClient.setQueryData(KEY, snapshot)
    const onFailure = vi.fn()
    const options = favoriteMutationOptions({
      queryClient,
      accountId: 'acc-1',
      nftId: 'b',
      request,
      now: () => NOW,
      onFailure,
      // sessão que não muda (a troca de conta é coberta em src/auth/sessionGuard.test.ts)
      captureSession: () => () => true,
    })
    return { queryClient, snapshot, onFailure, observer: new MutationObserver(queryClient, options) }
  }

  it('aplica o otimista antes de a request terminar', async () => {
    let release: () => void = () => {}
    const { queryClient, observer } = setup(() => new Promise<void>((resolve) => (release = resolve)))
    const done = observer.mutate(true)
    await vi.waitFor(() => expect(queryClient.getQueryData(KEY)).toEqual([fav('a'), fav('b', NOW)]))
    release()
    await done
  })

  it('falha: o cache volta a ser igual ao snapshot e avisa', async () => {
    const { queryClient, snapshot, onFailure, observer } = setup(() => Promise.reject(new Error('503')))
    await expect(observer.mutate(true)).rejects.toThrow('503')
    expect(queryClient.getQueryData(KEY)).toEqual(snapshot)
    expect(onFailure).toHaveBeenCalledTimes(1)
  })

  it('sucesso: mantém o otimista e invalida a lista da conta', async () => {
    const { queryClient, onFailure, observer } = setup(() => Promise.resolve())
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    await observer.mutate(true)
    expect(queryClient.getQueryData(KEY)).toEqual([fav('a'), fav('b', NOW)])
    expect(onFailure).not.toHaveBeenCalled()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: KEY })
  })

  it('falha sem lista no cache: desfaz o otimista', async () => {
    const { queryClient, observer } = setup(() => Promise.reject(new Error('503')))
    queryClient.removeQueries({ queryKey: KEY })
    await expect(observer.mutate(true)).rejects.toThrow('503')
    expect(isFavorited(queryClient.getQueryData(KEY), 'b')).toBe(false)
  })

  it('cliques em sequência: requests em série, só o último invalida e o cache fica no último clique', async () => {
    const calls: boolean[] = []
    const { queryClient, observer } = setup(async (_id, on) => {
      calls.push(on)
      await new Promise((r) => setTimeout(r, 5))
    })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const second = new MutationObserver(queryClient, observer.options)
    const a = observer.mutate(true)
    const b = second.mutate(false)
    await Promise.all([a, b])
    expect(calls).toEqual([true, false])
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(queryClient.getQueryData(KEY)).toEqual([fav('a')])
  })

  it('chama a request com o estado desejado', async () => {
    const request = vi.fn(() => Promise.resolve())
    const { observer } = setup(request)
    await observer.mutate(false)
    expect(request).toHaveBeenCalledWith('b', false)
  })
})
