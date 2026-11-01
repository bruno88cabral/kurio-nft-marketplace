// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  Link,
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { HeaderSearch } from './HeaderSearch'
import { MAIN_CONTENT_ID } from './SkipLink'

function renderAt(path: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <header className="relative">
          <HeaderSearch />
          <Link to="/cart">Carrinho</Link>
        </header>
        <main id={MAIN_CONTENT_ID} tabIndex={-1}>
          <Outlet />
        </main>
      </>
    ),
  })
  const routes = [
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === 'string' ? s.q : undefined }),
      component: () => <section id="catalogo" tabIndex={-1} aria-label="Catálogo" />,
    }),
    createRoute({ getParentRoute: () => rootRoute, path: '/cart', component: () => <p>Carrinho de NFTs</p> }),
  ]
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

const toggle = () => screen.findByRole('button', { name: /^(Buscar NFTs|Fechar busca)$/ })
const field = () => screen.queryByRole('search', { name: 'Buscar NFTs' })

afterEach(cleanup)

describe('HeaderSearch', () => {
  it('Enter busca e põe o foco no catálogo (o campo desmonta)', async () => {
    const router = renderAt('/cart')
    fireEvent.click(await toggle())
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'ape' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(document.activeElement?.id).toBe('catalogo'))
    expect(router.state.location.search).toMatchObject({ q: 'ape' })
    expect(field()).toBeNull()
  })

  it('Esc fecha e devolve o foco ao ícone', async () => {
    renderAt('/')
    fireEvent.click(await toggle())
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
    expect(field()).toBeNull()
    expect(document.activeElement).toBe(await toggle())
  })

  it('clique fora fecha sem mexer no foco; clique no campo não fecha', async () => {
    renderAt('/')
    fireEvent.click(await toggle())
    fireEvent.pointerDown(screen.getByRole('searchbox'))
    expect(field()).not.toBeNull()
    act(() => {
      screen.getByRole('region', { name: 'Catálogo' }).dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(field()).toBeNull()
    // O foco não volta para o ícone nem vai para o catálogo: fica com o que o clique focar (no jsdom, nada)
    expect(document.activeElement).not.toBe(await toggle())
    expect(document.activeElement?.id).not.toBe('catalogo')
  })

  it('navegar por outro link fecha o campo', async () => {
    const router = renderAt('/')
    fireEvent.click(await toggle())
    await act(() => router.navigate({ to: '/cart' }))
    await waitFor(() => expect(field()).toBeNull())
  })
})
