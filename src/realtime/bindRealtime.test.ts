import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { cartKeys } from '@/api/cart'
import { nftKeys } from '@/api/nfts'
import { orderKeys } from '@/api/orders'
import type { Nft, NftUpdatedEvent } from '@/contracts'
import { parseEth } from '@/lib/eth'
import { bindRealtime, CLIENT_DISCONNECT_REASON, type RealtimeSource } from './bindRealtime'
import { createReconciler } from './reconcile'

type Listener = (...args: never[]) => void

/** Socket falso: guarda os ouvintes por evento e deixa o teste disparar. */
function fakeSocket() {
  const listeners = new Map<string, Set<Listener>>()
  const source = {
    on: (event: string, listener: Listener) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)?.add(listener)
      return source
    },
    off: (event: string, listener: Listener) => {
      listeners.get(event)?.delete(listener)
      return source
    },
  } as unknown as RealtimeSource
  const fire = (event: string, ...args: unknown[]) => {
    for (const listener of listeners.get(event) ?? []) (listener as (...a: unknown[]) => void)(...args)
  }
  const count = () => [...listeners.values()].reduce((n, s) => n + s.size, 0)
  return { source, fire, count }
}

const nftEvent = (eventId: string, version: number, price: string): NftUpdatedEvent => ({
  eventId,
  resource: { type: 'nft', id: 'nft-001' },
  version,
  occurredAt: '2026-10-31T12:00:00.000Z',
  payload: { id: 'nft-001', price: parseEth(price), editions: [] },
})

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  const socket = fakeSocket()
  const reconciler = createReconciler()
  const unbind = bindRealtime({ socket: socket.source, queryClient, reconciler })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const roots = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey)
  return { queryClient, socket, reconciler, unbind, invalidate, roots }
}

describe('bindRealtime', () => {
  it('evento passa pelo reconciliador: duplicata e versão velha não mudam o cache', () => {
    const { queryClient, socket } = setup()
    queryClient.setQueryData(nftKeys.detail('nft-001'), { id: 'nft-001', price: parseEth('1'), editions: [] })
    const price = () => queryClient.getQueryData<Nft>(nftKeys.detail('nft-001'))?.price

    socket.fire('nft.updated', nftEvent('e2', 2, '2'))
    expect(price()).toBe('2')
    socket.fire('nft.updated', { ...nftEvent('e2', 2, '2'), payload: { id: 'nft-001', price: parseEth('9'), editions: [] } })
    expect(price()).toBe('2')
    socket.fire('nft.updated', nftEvent('e1', 1, '1.5'))
    expect(price()).toBe('2')
  })

  it('queda (transport close) seguida de connect invalida nfts, cart e orders, uma vez', () => {
    const { socket, roots } = setup()
    socket.fire('connect') // boot
    expect(roots()).toEqual([])

    socket.fire('disconnect', 'transport close')
    socket.fire('connect')
    expect(roots()).toEqual([nftKeys.all, cartKeys.all, orderKeys.all])

    // Outro connect sem nova queda não repete
    socket.fire('connect')
    expect(roots()).toHaveLength(3)
  })

  it('reconexão proposital (reconnectSocket: disconnect do cliente + connect) não invalida nada', () => {
    const { socket, invalidate } = setup()
    socket.fire('connect') // boot
    // login, logout, troca de conta e expiração: `socket.disconnect()` + `socket.connect()`
    socket.fire('disconnect', CLIENT_DISCONNECT_REASON)
    socket.fire('connect')
    socket.fire('disconnect', CLIENT_DISCONNECT_REASON)
    socket.fire('connect')
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('ping timeout e io server disconnect também contam como queda', () => {
    for (const reason of ['ping timeout', 'io server disconnect', 'transport error']) {
      const { socket, roots } = setup()
      socket.fire('disconnect', reason)
      socket.fire('connect')
      expect(roots()).toHaveLength(3)
    }
  })

  it('queda e depois login durante a queda: o connect do login ainda invalida (os eventos do intervalo se perderam)', () => {
    const { socket, roots } = setup()
    socket.fire('disconnect', 'transport close')
    socket.fire('disconnect', CLIENT_DISCONNECT_REASON) // reconnectSocket do login, ainda sem conexão
    socket.fire('connect')
    expect(roots()).toHaveLength(3)
  })

  it('unbind tira todos os ouvintes', () => {
    const { socket, unbind } = setup()
    expect(socket.count()).toBe(4)
    unbind()
    expect(socket.count()).toBe(0)
  })
})
