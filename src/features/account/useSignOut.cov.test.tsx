// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
// Só pelo efeito colateral: registra o cleanup e a limpeza de storage do afterEach
import '@/test/render'
import { navigateSpy } from '@/test/routerMock'
import { focusMainContent, SIGNED_OUT_MESSAGE, useSignOut } from './useSignOut'

const { endSession, success } = vi.hoisted(() => ({ endSession: vi.fn(), success: vi.fn() }))

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
vi.mock('@/auth/sessionLifecycle', () => ({ sessionLifecycle: { endSession } }))
vi.mock('sonner', () => ({ toast: { success } }))

function addMain() {
  const main = document.createElement('main')
  main.id = 'conteudo'
  main.tabIndex = -1
  document.body.append(main)
  return main
}

beforeEach(() => {
  endSession.mockReset().mockResolvedValue(undefined)
  success.mockReset()
  document.body.innerHTML = ''
})

describe('focusMainContent', () => {
  it('foca o main quando existe e não quebra quando não existe', () => {
    expect(() => focusMainContent()).not.toThrow()
    const main = addMain()
    focusMainContent()
    expect(document.activeElement).toBe(main)
  })
})

describe('useSignOut', () => {
  it('encerra a sessão por logout, avisa, vai ao Início e foca o conteúdo', async () => {
    const main = addMain()
    const { result } = renderHook(() => useSignOut())
    expect(result.current.pending).toBe(false)
    await act(() => result.current.signOut())
    expect(endSession).toHaveBeenCalledWith('logout')
    expect(success).toHaveBeenCalledWith(SIGNED_OUT_MESSAGE)
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/' })
    expect(document.activeElement).toBe(main)
    expect(result.current.pending).toBe(false)
  })

  it('ignora um segundo "Sair" enquanto o primeiro está pendente', async () => {
    let finish!: () => void
    endSession.mockReturnValue(new Promise<void>((r) => (finish = r)))
    const { result } = renderHook(() => useSignOut())
    let first!: Promise<void>
    act(() => {
      first = result.current.signOut()
    })
    await waitFor(() => expect(result.current.pending).toBe(true))
    await act(() => result.current.signOut())
    expect(endSession).toHaveBeenCalledTimes(1)
    finish()
    await act(() => first)
    expect(result.current.pending).toBe(false)
  })

  it('falha no logout libera o pending e propaga o erro, sem toast', async () => {
    endSession.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useSignOut())
    await act(async () => {
      await expect(result.current.signOut()).rejects.toThrow('boom')
    })
    expect(result.current.pending).toBe(false)
    expect(success).not.toHaveBeenCalled()
  })
})
