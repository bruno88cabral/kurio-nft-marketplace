// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRouter,
} from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ApiError } from '@/contracts'
import { validateRedirectSearch } from '@/lib/redirectSearch'

const auth = vi.hoisted(() => ({ login: vi.fn(), signup: vi.fn() }))
vi.mock('@/api/auth', () => auth)
vi.mock('@/auth/useSession', () => ({ useSession: () => ({ account: null, isAuthenticated: false, isPending: false }) }))
vi.mock('@/auth/sessionLifecycle', () => ({
  AUTH_ROUTES: ['/login', '/signup'],
  sessionLifecycle: { establishSession: vi.fn(), captureSession: () => () => true },
}))
// O fundo do modal (seções do Início) busca dados: fora do escopo deste teste
vi.mock('@/features/catalog/HeroFeatured', () => ({ HeroFeatured: () => null }))
vi.mock('@/features/catalog/PromoCards', () => ({ PromoCards: () => null }))
vi.mock('@/features/catalog/MintJournal', () => ({ MintJournal: () => null }))

const { AuthDialog } = await import('./AuthDialog')
const { LoginForm } = await import('./LoginForm')
const { SignupForm } = await import('./SignupForm')

afterEach(cleanup)
beforeEach(() => {
  auth.login.mockReset()
  auth.signup.mockReset()
})

function renderAt(path: string): AnyRouter {
  const rootRoute = createRootRoute({
    component: () => (
      <TooltipProvider>
        <Outlet />
      </TooltipProvider>
    ),
  })
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    validateSearch: validateRedirectSearch,
    component: function Login() {
      const { redirect } = loginRoute.useSearch()
      return (
        <AuthDialog mode="login" redirect={redirect}>
          <LoginForm redirect={redirect} />
        </AuthDialog>
      )
    },
  })
  const signupRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/signup',
    validateSearch: validateRedirectSearch,
    component: function Signup() {
      const { redirect } = signupRoute.useSearch()
      return (
        <AuthDialog mode="signup" redirect={redirect}>
          <SignupForm redirect={redirect} />
        </AuthDialog>
      )
    },
  })
  const routes = [
    createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <p>início</p> }),
    createRoute({ getParentRoute: () => rootRoute, path: '/cart', component: () => <p>carrinho</p> }),
    loginRoute,
    signupRoute,
  ]
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

const href = (router: AnyRouter) => router.state.location.href

describe('AuthDialog: abas, fechar e redirect', () => {
  it('as abas Entrar | Criar conta trocam de rota e preservam o redirect', async () => {
    const router = renderAt('/login?redirect=%2Fcart')
    const nav = await screen.findByRole('navigation', { name: 'Entrar ou criar conta' })
    const entrar = screen.getByRole('link', { name: 'Entrar' })
    const criar = screen.getByRole('link', { name: 'Criar conta' })
    expect(nav.contains(entrar) && nav.contains(criar)).toBe(true)
    expect(entrar.getAttribute('aria-current')).toBe('page')
    expect(criar.getAttribute('aria-current')).toBeNull()

    fireEvent.click(criar)
    await waitFor(() => expect(href(router)).toBe('/signup?redirect=%2Fcart'))
    expect((await screen.findByRole('link', { name: 'Criar conta' })).getAttribute('aria-current')).toBe('page')

    fireEvent.click(screen.getByRole('link', { name: 'Entrar' }))
    await waitFor(() => expect(href(router)).toBe('/login?redirect=%2Fcart'))
  })

  it('o rodapé do mobile também troca de rota com o redirect', async () => {
    const router = renderAt('/login?redirect=%2Fcart')
    fireEvent.click(await screen.findByRole('link', { name: 'Crie uma conta' }))
    await waitFor(() => expect(href(router)).toBe('/signup?redirect=%2Fcart'))
    fireEvent.click(await screen.findByRole('link', { name: 'Entre' }))
    await waitFor(() => expect(href(router)).toBe('/login?redirect=%2Fcart'))
  })

  it('o X fecha e vai para o redirect', async () => {
    const router = renderAt('/login?redirect=%2Fcart')
    fireEvent.click(await screen.findByRole('button', { name: 'Fechar' }))
    await screen.findByText('carrinho')
    expect(href(router)).toBe('/cart')
  })

  it('Esc fecha e vai para o redirect', async () => {
    const router = renderAt('/signup?redirect=%2Fcart')
    const dialog = await screen.findByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await screen.findByText('carrinho')
    expect(href(router)).toBe('/cart')
  })

  it('o Voltar do mobile fecha como o X; sem redirect vai para o Início', async () => {
    const router = renderAt('/login')
    fireEvent.click(await screen.findByRole('button', { name: 'Voltar' }))
    await screen.findByText('início')
    expect(href(router)).toBe('/')
  })

  it('o diálogo tem o título e o texto de apoio do Figma', async () => {
    renderAt('/signup')
    expect(
      await screen.findByRole('dialog', {
        name: 'Criar perfil de colecionador',
        description: 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.',
      }),
    ).toBeTruthy()
  })
})

describe('Formulários: rótulos e erros associados aos campos', () => {
  it('login: rótulos visíveis e envio vazio liga cada erro ao seu campo, sem request', async () => {
    renderAt('/login')
    await screen.findByRole('dialog')
    // Rótulo visível (não sr-only) com o placeholder do Figma
    const label = screen.getByText('E-mail', { selector: 'label' })
    expect(label.className).not.toContain('sr-only')
    expect(screen.getByRole('textbox', { name: /E-mail/ }).getAttribute('placeholder')).toBe('contato@email.com')

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('textbox', { name: /E-mail/, description: 'Informe seu e-mail.' })).toBeTruthy()
    expect(screen.getByLabelText(/^Senha/).getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(screen.getByLabelText(/^Senha/).getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Informe sua senha.',
    )
    expect(auth.login).not.toHaveBeenCalled()
  })

  it('login: senha errada mostra o alerta do formulário e o modal continua', async () => {
    auth.login.mockRejectedValue(new ApiError({ code: 'unauthorized', message: 'x' }, 401))
    const router = renderAt('/login?redirect=%2Fcart')
    fireEvent.change(await screen.findByRole('textbox', { name: /E-mail/ }), { target: { value: 'ana@kurio.test' } })
    fireEvent.change(screen.getByLabelText(/^Senha/), { target: { value: 'errada123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect((await screen.findByRole('alert')).textContent).toContain('E-mail ou senha inválidos.')
    expect(href(router)).toBe('/login?redirect=%2Fcart')
  })

  it('cadastro: envio vazio dá 4 erros associados, e a senha mantém o aviso de demonstração', async () => {
    renderAt('/signup')
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: /Criar perfil\s*Criar conta/ }))
    expect(await screen.findByRole('textbox', { name: /Nome de usuário/, description: 'Informe seu nome.' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /E-mail/, description: 'Informe seu e-mail.' })).toBeTruthy()
    const describedBy = (el: HTMLElement) =>
      (el.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent)
        .join(' ')
    expect(describedBy(screen.getByLabelText(/^Senha/))).toBe(
      'Ambiente de demonstração: não use uma senha real. Informe sua senha.',
    )
    expect(describedBy(screen.getByLabelText(/^Confirmar senha/))).toBe('Confirme sua senha.')
    expect(auth.signup).not.toHaveBeenCalled()
  })

  it('cadastro: conflito liga a mensagem ao e-mail e o link mantém o redirect', async () => {
    auth.signup.mockRejectedValue(new ApiError({ code: 'conflict', message: 'x' }, 409))
    renderAt('/signup?redirect=%2Fcart')
    fireEvent.change(await screen.findByRole('textbox', { name: /Nome de usuário/ }), { target: { value: 'Teste' } })
    fireEvent.change(screen.getByRole('textbox', { name: /E-mail/ }), { target: { value: 'novo@kurio.test' } })
    fireEvent.change(screen.getByLabelText(/^Senha/), { target: { value: 'Kurio#2026x' } })
    fireEvent.change(screen.getByLabelText(/^Confirmar senha/), { target: { value: 'Kurio#2026x' } })
    fireEvent.click(screen.getByRole('button', { name: /Criar perfil\s*Criar conta/ }))
    expect(
      await screen.findByRole('textbox', { name: /E-mail/, description: 'Já existe uma conta com este e-mail.' }),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Entrar com este e-mail' }).getAttribute('href')).toBe(
      '/login?redirect=%2Fcart',
    )
  })
})

describe('Ações fora de escopo ("Em breve")', () => {
  it.each(['/login', '/signup'])('%s: Google e Facebook são "Em breve" e não disparam nada', async (path) => {
    const router = renderAt(path)
    await screen.findByRole('dialog')
    for (const name of [/^Continuar com Google\s*\(em breve\)$/, /^Continuar com Facebook\s*\(em breve\)$/]) {
      const button = screen.getByRole('button', { name })
      expect(button.getAttribute('aria-disabled')).toBe('true')
      fireEvent.click(button)
    }
    expect(auth.login).not.toHaveBeenCalled()
    expect(auth.signup).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe(path)
  })

  it('"Esqueceu a senha?" é "Em breve" e não envia nem navega', async () => {
    const router = renderAt('/login')
    const button = await screen.findByRole('button', { name: /^Esqueceu a senha\?\s*\(em breve\)$/ })
    expect(button.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(button)
    expect(auth.login).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.queryByText('Informe seu e-mail.')).toBeNull()
  })
})
