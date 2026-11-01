// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'

// Só as partes com sessão/cache saem: o header e o router são os de verdade
vi.mock('@/features/cart/useCartCount', () => ({ useCartCount: () => 0 }))
vi.mock('./AccountMenu', () => ({ AccountMenu: () => null }))

const { SiteHeader } = await import('./SiteHeader')

function renderAt(path: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <TooltipProvider>
        <SiteHeader />
      </TooltipProvider>
    ),
  })
  const routes = [
    createRoute({ getParentRoute: () => rootRoute, path: '/' }),
    createRoute({ getParentRoute: () => rootRoute, path: '/nfts/$nftId' }),
    createRoute({ getParentRoute: () => rootRoute, path: '/cart' }),
  ]
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(<RouterProvider router={router} />)
}

const nav = () => screen.findByRole('navigation', { name: 'Principal' })

afterEach(cleanup)

describe('SiteHeader: item ativo', () => {
  it('no Detalhe (/nfts/*) o ativo é "Mercado"', async () => {
    renderAt('/nfts/nft-001')
    await nav()
    expect(screen.getByRole('link', { name: 'Mercado' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBeNull()
  })

  it('no Início o ativo é "Início", e fora do catálogo nenhum item fica ativo', async () => {
    renderAt('/')
    await nav()
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Mercado' }).getAttribute('aria-current')).toBeNull()
    cleanup()
    renderAt('/cart')
    await nav()
    expect(screen.getByRole('link', { name: 'Mercado' }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBeNull()
  })

  it('"Em breve" (Criadores, Aprenda) não fica laranja no hover, como um link', async () => {
    renderAt('/')
    await nav()
    for (const name of [/^Criadores/, /^Aprenda/]) {
      const item = screen.getByRole('button', { name })
      expect(item.getAttribute('aria-disabled')).toBe('true')
      expect(item.className).toContain('hover:text-foreground')
      expect(item.className).not.toContain('hover:text-text-accent')
    }
  })
})
