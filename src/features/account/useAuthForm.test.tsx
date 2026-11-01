// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { FormEvent, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/contracts'
import { createTestQueryClient } from '@/test/render'
import { navigateSpy } from '@/test/routerMock'
import { useAuthForm } from './useAuthForm'

const { establishSession } = vi.hoisted(() => ({ establishSession: vi.fn() }))

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
vi.mock('@/auth/sessionLifecycle', () => ({
  sessionLifecycle: { establishSession, captureSession: () => () => true },
}))

const AUTH = { token: 't', expiresAt: '2099-01-01T00:00:00.000Z', account: { id: 'u', email: 'a@kurio.test', name: 'A' } }
const FIELDS = ['email', 'password'] as const
type V = { email: string; password: string }

function setup(request: (v: V) => Promise<typeof AUTH>, redirect?: string) {
  const client = createTestQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return renderHook(
    () =>
      useAuthForm<(typeof FIELDS)[number], V>({
        fields: FIELDS,
        initial: { email: 'a@kurio.test', password: 'x' },
        validate: () => ({}),
        request,
        redirect,
      }),
    { wrapper },
  )
}
const submit = (result: { current: ReturnType<typeof setup>['result']['current'] }) =>
  act(() => result.current.onSubmit({ preventDefault() {} } as FormEvent<HTMLFormElement>))

beforeEach(() => establishSession.mockReset())

describe('useAuthForm', () => {
  it('sucesso: estabelece a sessão uma vez, navega e continua ocupado', async () => {
    const request = vi.fn().mockResolvedValue(AUTH)
    const { result } = setup(request, '/profile')
    submit(result)
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith({ href: '/profile', replace: true }))
    expect(establishSession).toHaveBeenCalledTimes(1)
    expect(establishSession).toHaveBeenCalledWith(AUTH)
    expect(result.current.submitting).toBe(true)
    // segundo envio enquanto ocupado é ignorado
    submit(result)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('erro de campo (422) vira apiErrors e não estabelece a sessão', async () => {
    const request = vi.fn().mockRejectedValue(new ApiError({ code: 'validation', message: 'm', fieldErrors: { email: 'E-mail inválido.' } }, 422))
    const { result } = setup(request)
    submit(result)
    await waitFor(() => expect(result.current.apiErrors.email).toBe('E-mail inválido.'))
    expect(result.current.formError).toBeUndefined()
    expect(result.current.submitting).toBe(false)
    expect(establishSession).not.toHaveBeenCalled()
    expect(navigateSpy).not.toHaveBeenCalled()
  })
})
