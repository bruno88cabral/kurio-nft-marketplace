// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
} from '@tanstack/react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { useHideMobileChrome } from './routeChrome'

afterEach(cleanup)

function Probe() {
  const hidden = useHideMobileChrome()
  return (
    <>
      <p data-testid="chrome">{hidden === true ? 'escondida' : hidden === 'header' ? 'sem header' : 'visível'}</p>
      <Outlet />
    </>
  )
}

function renderAt(path: string) {
  const rootRoute = createRootRoute({ component: Probe })
  const routes = [
    createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <p>início</p> }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/imersiva',
      staticData: { hideMobileChrome: true },
      component: () => <p>imersiva</p>,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/sem-header',
      staticData: { hideMobileChrome: 'header' },
      component: () => <p>página sem header</p>,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/sumiu',
      staticData: { hideMobileChrome: true },
      loader: () => {
        // notFound() do TanStack Router é lançado por design (como em src/routes)
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw notFound()
      },
      component: () => <p>nunca</p>,
      notFoundComponent: () => <p>não encontrado</p>,
    }),
  ]
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(<RouterProvider router={router} />)
}

describe('useHideMobileChrome (staticData.hideMobileChrome)', () => {
  it('rota sem a flag: moldura visível', async () => {
    renderAt('/')
    await screen.findByText('início')
    expect(screen.getByTestId('chrome').textContent).toBe('visível')
  })

  it('rota com a flag: moldura escondida', async () => {
    renderAt('/imersiva')
    await screen.findByText('imersiva')
    expect(screen.getByTestId('chrome').textContent).toBe('escondida')
  })

  it("rota com 'header': esconde só o header (a tab bar fica)", async () => {
    renderAt('/sem-header')
    await screen.findByText('página sem header')
    expect(screen.getByTestId('chrome').textContent).toBe('sem header')
  })

  it('rota com a flag que deu "não encontrado": a moldura volta', async () => {
    renderAt('/sumiu')
    await screen.findByText('não encontrado')
    expect(screen.getByTestId('chrome').textContent).toBe('visível')
  })
})
