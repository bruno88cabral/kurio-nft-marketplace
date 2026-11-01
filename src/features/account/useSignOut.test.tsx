// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSignOut } from './useSignOut'

const calls = vi.hoisted(() => [] as string[])
const navigate = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const endSession = vi.hoisted(() =>
  vi.fn((reason: string) => {
    calls.push(`endSession:${reason}`)
    return Promise.resolve()
  }),
)
const dropCollectorForms = vi.hoisted(() => vi.fn(() => void calls.push('dropCollectorForms')))

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))
vi.mock('@/auth/sessionLifecycle', () => ({ sessionLifecycle: { endSession } }))
vi.mock('@/features/checkout/checkoutDraft', () => ({ dropCollectorForms }))

afterEach(() => {
  cleanup()
  calls.length = 0
  vi.clearAllMocks()
})

describe('useSignOut', () => {
  it('o logout explícito tira o formulário do colecionador depois de encerrar a sessão (MYK-1114 D7)', async () => {
    const { result } = renderHook(() => useSignOut())
    await act(() => result.current.signOut())
    expect(calls).toEqual(['endSession:logout', 'dropCollectorForms'])
    expect(navigate).toHaveBeenCalledWith({ to: '/' })
  })
})
