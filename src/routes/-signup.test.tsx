// @vitest-environment jsdom
import { isRedirect } from '@tanstack/react-router'
import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SESSION_STORAGE_KEY } from '@/auth/sessionStorage'
import { renderWithProviders } from '@/test/render'
import { Route } from './signup'

// Rota real (createFileRoute/redirect de verdade) com os hooks do router mockados para renderizar o componente
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  const mock = (await import('@/test/routerMock')).routerMock()
  return { ...actual, ...mock, createFileRoute: actual.createFileRoute }
})
vi.mock('@/features/account/AuthDialog', () => ({
  AuthDialog: ({ title, description, redirect, children }: { title: string; description: string; redirect?: string; children: React.ReactNode }) => (
    <section aria-label="dialogo" data-redirect={redirect ?? ''}>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </section>
  ),
}))
vi.mock('@/features/account/SignupForm', () => ({
  SignupForm: ({ redirect }: { redirect?: string }) => <p data-testid="form">{redirect ?? 'sem-redirect'}</p>,
}))

const options = Route.options as unknown as {
  head: () => { meta: { title: string }[] }
  validateSearch: (s: Record<string, unknown>) => { redirect?: string }
  beforeLoad: (ctx: { search: { redirect?: string } }) => void
  component: (() => React.ReactNode) & { preload?: () => Promise<void> }
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

function guardarSessao() {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString() }))
}

function thrownBy(fn: () => void): unknown {
  try {
    fn()
  } catch (error) {
    return error
  }
  return undefined
}

describe('rota signup', () => {
  it('head define o título', () => {
    expect(options.head().meta).toEqual([{ title: 'Criar conta · Kurio' }])
  })

  it('validateSearch mantém redirect interno e descarta o resto', () => {
    expect(options.validateSearch({ redirect: '/cart' })).toEqual({ redirect: '/cart' })
    expect(options.validateSearch({ redirect: '//evil.example' })).toEqual({ redirect: undefined })
    expect(options.validateSearch({})).toEqual({ redirect: undefined })
  })

  it('beforeLoad deixa o visitante passar', () => {
    expect(thrownBy(() => options.beforeLoad({ search: { redirect: '/cart' } }))).toBeUndefined()
  })

  it('beforeLoad manda quem já tem sessão para o redirect', () => {
    guardarSessao()
    const error = thrownBy(() => options.beforeLoad({ search: { redirect: '/cart' } }))
    expect(isRedirect(error)).toBe(true)
    expect((error as { options: unknown }).options).toMatchObject({ href: '/cart', replace: true })
  })

  it('beforeLoad com sessão e sem redirect vai para /', () => {
    guardarSessao()
    const error = thrownBy(() => options.beforeLoad({ search: {} }))
    expect((error as { options: unknown }).options).toMatchObject({ href: '/', replace: true })
  })

  it('o componente (code-split, lazy) monta o diálogo com o formulário e o redirect da busca', async () => {
    // O componente lê a busca por `Route.useSearch` (a rota é a real, sem RouterProvider)
    vi.spyOn(Route, 'useSearch').mockReturnValue({ redirect: '/cart' })
    const Component = options.component
    // O plugin do router separa o componente em outro módulo (lazy): carrega antes, para não suspender no render
    await Component.preload?.()
    renderWithProviders(<Component />)
    expect(await screen.findByRole('heading', { name: 'Criar conta' })).toBeTruthy()
    expect(screen.getByLabelText('dialogo').getAttribute('data-redirect')).toBe('/cart')
    expect(screen.getByTestId('form').textContent).toBe('/cart')
  })
})
