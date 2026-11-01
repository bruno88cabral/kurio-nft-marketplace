// @vitest-environment jsdom
import { isRedirect } from '@tanstack/react-router'
import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { guardarSessao, thrownBy } from '@/test/authRoute'
import { renderWithProviders } from '@/test/render'
import { Route } from './signup'

// Rota real (createFileRoute/redirect de verdade) com os hooks do router mockados para renderizar o componente
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return (await import('@/test/routerMock')).routeModuleMock(actual)
})
vi.mock('@/features/account/AuthDialog', async () => ({ AuthDialog: (await import('@/test/authRoute')).AuthDialogStub }))
vi.mock('@/features/account/SignupForm', () => ({
  SignupForm: ({ redirect }: { redirect?: string }) => <p data-testid="form">{redirect ?? 'sem-redirect'}</p>,
}))

const options = Route.options as unknown as {
  head: () => { meta: { title: string }[] }
  validateSearch: (s: Record<string, unknown>) => { redirect?: string }
  beforeLoad: (ctx: { search: { redirect?: string } }) => void
  component: () => React.ReactNode
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

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

  it('o componente monta o diálogo com o formulário e o redirect da busca', async () => {
    // O componente lê a busca por `Route.useSearch` (a rota é a real, sem RouterProvider)
    vi.spyOn(Route, 'useSearch').mockReturnValue({ redirect: '/cart' })
    const Component = options.component
    renderWithProviders(<Component />)
    expect(await screen.findByRole('heading', { name: 'Criar conta' })).toBeTruthy()
    expect(screen.getByLabelText('dialogo').getAttribute('data-redirect')).toBe('/cart')
    expect(screen.getByTestId('form').textContent).toBe('/cart')
  })
})
