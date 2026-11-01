// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'

// Só a sessão e o cache saem: a barra e o router são os de verdade
vi.mock('@/features/cart/useCartCount', () => ({ useCartCount: () => 3 }))
vi.mock('@/auth/useSession', () => ({
  useSession: () => ({ account: null, isAuthenticated: false, isPending: false }),
}))

const { MobileTabBar } = await import('./MobileTabBar')

function renderAt(path: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <TooltipProvider>
        <MobileTabBar />
      </TooltipProvider>
    ),
  })
  const routes = ['/', '/cart', '/login', '/profile'].map((p) => createRoute({ getParentRoute: () => rootRoute, path: p }))
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(<RouterProvider router={router} />)
}

const bar = () => screen.findByRole('navigation', { name: 'Navegação principal (mobile)' })

afterEach(cleanup)

describe('MobileTabBar (Figma mobile)', () => {
  it('tem Início, Favoritos, o botão central, Carrinho com a contagem e Conta, nessa ordem', async () => {
    renderAt('/')
    const items = within(await bar()).getAllByRole('listitem')
    const names = items.map((li) => {
      const el = li.querySelector('a,button')
      return el?.getAttribute('aria-label') ?? el?.textContent?.trim()
    })
    expect(names).toEqual(['Início', 'Favoritos (em breve)', 'Escanear (em breve)', 'Carrinho, 3 itens', 'Entrar'])
  })

  it('Favoritos e o botão central são "Em breve" (aria-disabled), sem aparentar funcionar', async () => {
    renderAt('/')
    const nav = await bar()
    for (const name of [/^Favoritos/, /^Escanear/]) {
      expect(within(nav).getByRole('button', { name }).getAttribute('aria-disabled')).toBe('true')
    }
  })

  it('Início é o atual em `/`, mesmo com a busca do catálogo na URL', async () => {
    renderAt('/?tab=new&page=2')
    const nav = await bar()
    expect(within(nav).getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBe('page')
  })

  it('no carrinho o atual é o Carrinho, e o visitante tem "Entrar" na Conta', async () => {
    renderAt('/cart')
    const nav = await bar()
    expect(within(nav).getByRole('link', { name: /^Carrinho/ }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBeNull()
    expect(within(nav).getByRole('link', { name: 'Entrar' }).getAttribute('href')).toMatch(/^\/login/)
  })
})
