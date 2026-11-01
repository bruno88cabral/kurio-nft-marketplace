// @vitest-environment jsdom
import { isRedirect, type ErrorComponentProps } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { fireEvent, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_STORAGE_KEY } from '@/auth/sessionStorage'
import { ApiError } from '@/contracts'
import { renderWithProviders } from '@/test/render'
import { invalidateSpy } from '@/test/routerMock'
import { Route } from './_authenticated'

// Rota real (createFileRoute/redirect de verdade) com os hooks do router mockados para renderizar o errorComponent
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  const mock = (await import('@/test/routerMock')).routerMock()
  return { ...actual, ...mock, createFileRoute: actual.createFileRoute }
})

type Ctx = { context: { queryClient: Pick<QueryClient, 'ensureQueryData'> }; location: { href: string } }
const options = Route.options as unknown as {
  beforeLoad: (ctx: Ctx) => Promise<void>
  errorComponent: ((props: ErrorComponentProps) => ReactNode)
}

// Função simples (não `vi.fn`): o Vitest marca como não tratada a rejeição devolvida por um mock
type Ensure = (options: { queryKey: readonly unknown[] }) => Promise<unknown>
let ensureImpl: Ensure
const ensureCalls: { queryKey: readonly unknown[] }[] = []
const ensureQueryData = ((options: { queryKey: readonly unknown[] }) => {
  ensureCalls.push(options)
  return ensureImpl(options)
}) as unknown as QueryClient['ensureQueryData']
const ctx = (href = '/profile?tab=1'): Ctx => ({ context: { queryClient: { ensureQueryData } }, location: { href } })

function guardarSessao() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString() }))
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  return undefined
}

beforeEach(() => {
  ensureCalls.length = 0
  ensureImpl = () => Promise.resolve({})
})
afterEach(() => localStorage.clear())

describe('beforeLoad de /_authenticated', () => {
  it('sem token manda para /login com o href atual no redirect, sem consultar a sessão', async () => {
    const error = await rejectionOf(options.beforeLoad(ctx()))
    expect(isRedirect(error)).toBe(true)
    expect((error as { options: unknown }).options).toMatchObject({ to: '/login', search: { redirect: '/profile?tab=1' }, replace: true })
    expect(ensureCalls).toHaveLength(0)
  })

  it('com token confirma a sessão (do cache, se já veio) e deixa passar', async () => {
    guardarSessao()
    await expect(options.beforeLoad(ctx())).resolves.toBeUndefined()
    expect(ensureCalls).toHaveLength(1)
    expect(ensureCalls[0].queryKey).toEqual(['session'])
  })

  it('401 com o token atual vai ao login', async () => {
    guardarSessao()
    ensureImpl = () => Promise.reject(new ApiError({ code: 'unauthorized', message: 'x' }, 401))
    const error = await rejectionOf(options.beforeLoad(ctx('/wallets')))
    expect(isRedirect(error)).toBe(true)
    expect((error as { options: unknown }).options).toMatchObject({ to: '/login', search: { redirect: '/wallets' } })
  })

  it('falha qualquer com a sessão já apagada (notifyExpired cancelou a query) vai ao login', async () => {
    guardarSessao()
    ensureImpl = () => {
      localStorage.clear()
      return Promise.reject(new Error('CancelledError'))
    }
    const error = await rejectionOf(options.beforeLoad(ctx('/wallets')))
    expect(isRedirect(error)).toBe(true)
  })

  it('falha de rede/servidor com o token intacto propaga o erro (errorComponent), sem apagar a sessão', async () => {
    guardarSessao()
    const boom = new ApiError({ code: 'transient', message: 'fora' }, 503)
    ensureImpl = () => Promise.reject(boom)
    expect(await rejectionOf(options.beforeLoad(ctx()))).toBe(boom)
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull()
  })
})

describe('errorComponent de /_authenticated', () => {
  it('mostra o aviso e "Tentar novamente" reinicia o boundary e invalida o router', () => {
    const reset = vi.fn()
    const ErrorView = options.errorComponent
    renderWithProviders(<ErrorView error={new Error('x')} reset={reset} info={undefined} />)
    expect(screen.getByText('Não foi possível confirmar sua sessão.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }))
    expect(reset).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
  })
})
