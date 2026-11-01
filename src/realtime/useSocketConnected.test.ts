// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Socket falso no lugar do socket.io-client: `connected` mutável e ouvintes de connect/disconnect
const fake = vi.hoisted(() => {
  const listeners = new Map<string, Set<() => void>>()
  const socket = {
    connected: false,
    on: (event: string, listener: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)?.add(listener)
    },
    off: (event: string, listener: () => void) => listeners.get(event)?.delete(listener),
  }
  const fire = (event: 'connect' | 'disconnect', connected: boolean) => {
    socket.connected = connected
    for (const listener of listeners.get(event) ?? []) listener()
  }
  return { listeners, socket, fire }
})
vi.mock('./socket', () => ({ socket: fake.socket }))

const { useSocketConnected } = await import('./useSocketConnected')

describe('useSocketConnected', () => {
  it('reflete socket.connected e re-renderiza ao cair e ao voltar', () => {
    const { result, unmount } = renderHook(() => useSocketConnected())
    expect(result.current).toBe(false)

    act(() => fake.fire('connect', true))
    expect(result.current).toBe(true)

    act(() => fake.fire('disconnect', false))
    expect(result.current).toBe(false)

    unmount()
    expect([...fake.listeners.values()].every((s) => s.size === 0)).toBe(true)
  })
})
