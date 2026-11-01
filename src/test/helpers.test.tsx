// @vitest-environment jsdom
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link, Navigate, Outlet, useCanGoBack, useLocation, useNavigate, useParams, useRouter, useSearch } from '@tanstack/react-router'
import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installDomPolyfills } from './dom'
import { createTestQueryClient, renderWithProviders } from './render'
import { historyBackSpy, invalidateSpy, navigateSpy, setCanGoBack, setLoaderData, setLocation, setParams, setSearch } from './routerMock'
import { ANA, BRUNO, sessionOf } from './session'

vi.mock('@tanstack/react-router', async () => (await import('./routerMock')).routerMock())

function Failing({ fn }: { fn: () => Promise<unknown> }) {
  const q = useQuery({ queryKey: ['x'], queryFn: fn })
  return <p>{q.status}</p>
}

function Nav() {
  const navigate = useNavigate()
  return (
    <>
      <Link to="/cart" className="c" aria-label="Ir" onClick={(e) => {
          e.preventDefault()
          void navigate({ to: '/login' })
        }}>
        texto
      </Link>
      <output>{JSON.stringify([useSearch({ from: '/' }), useParams({ from: '/' }), useLocation()])}</output>
    </>
  )
}

const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
beforeEach(() => errorSpy.mockClear())
afterEach(() => expect(errorSpy).not.toHaveBeenCalled())

describe('helpers de teste', () => {
  it('renderWithProviders dá um QueryClient novo a cada render', () => {
    const a = renderWithProviders(<p>a</p>)
    const b = renderWithProviders(<p>b</p>)
    expect(a.queryClient).not.toBe(b.queryClient)
    const own = createTestQueryClient()
    expect(renderWithProviders(<p>c</p>, { queryClient: own }).queryClient).toBe(own)
  })

  it('queries não fazem retry', async () => {
    const fn = vi.fn(() => Promise.reject(new Error('boom')))
    renderWithProviders(<Failing fn={fn} />)
    await waitFor(() => expect(screen.getByText('error')).toBeTruthy())
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('storage é limpo entre testes (1/2)', () => {
    localStorage.setItem('kurio:session', 'x')
    expect(localStorage.getItem('kurio:session')).toBe('x')
  })

  it('storage é limpo entre testes (2/2)', () => {
    expect(localStorage.getItem('kurio:session')).toBeNull()
  })

  it('routerMock: Link vira <a href> e useNavigate devolve navigateSpy', () => {
    renderWithProviders(<Nav />)
    const link = screen.getByRole('link', { name: 'Ir' })
    expect(link.getAttribute('href')).toBe('/cart')
    expect(link.className).toBe('c')
    link.click()
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/login' })
  })

  it('routerMock: search, params e location são controlados por teste e voltam ao padrão', () => {
    setSearch({ q: 'sol' })
    setParams({ nftId: 'nft-1' })
    setLocation({ pathname: '/x' })
    renderWithProviders(<Nav />)
    expect(screen.getByRole('status').textContent).toBe(JSON.stringify([{ q: 'sol' }, { nftId: 'nft-1' }, { pathname: '/x' }]))
  })

  it('routerMock: o padrão é {} depois do afterEach', () => {
    renderWithProviders(<Nav />)
    expect(screen.getByRole('status').textContent).toBe('[{},{},{}]')
  })

  it('sessionOf devolve visitante ou conta', () => {
    expect(sessionOf(null)).toEqual({ account: undefined, isAuthenticated: false, isPending: false })
    expect(sessionOf(ANA)).toEqual({ account: ANA, isAuthenticated: true, isPending: false })
    expect(BRUNO.id).toBe('user-bruno')
  })

  it('installDomPolyfills não sobrescreve implementação existente', () => {
    class X {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    const original = window.ResizeObserver
    window.ResizeObserver = X
    try {
      installDomPolyfills()
      expect(window.ResizeObserver).toBe(X)
    } finally {
      window.ResizeObserver = original
    }
    expect(window.matchMedia('(min-width: 1px)').matches).toBe(false)
  })

  it('routerMock: Link monta href e não vaza props do router para o DOM', () => {
    setSearch({ q: 'a' })
    setLocation({ pathname: '/cart' })
    renderWithProviders(
      <>
        <Link to="/nfts/$nftId" params={{ nftId: 'nft-002' }}>
          detalhe
        </Link>
        <Link to="/" search={{ q: 'sol', page: 2, tab: undefined }} hash="topo" replace activeOptions={{ exact: true }} preload="intent">
          busca
        </Link>
        <Link to="/" search={(prev: { q?: string }) => ({ ...prev, page: 3 })}>
          fn
        </Link>
        <Link to="/cart" activeProps={{ className: 'x' }} inactiveProps={{}} resetScroll={false}>
          {({ isActive }) => (isActive ? 'ativo' : 'inativo')}
        </Link>
        <Link to="/login">{({ isActive }) => (isActive ? 'ativo' : 'inativo')}</Link>
      </>,
    )
    expect(screen.getByRole('link', { name: 'detalhe' }).getAttribute('href')).toBe('/nfts/nft-002')
    const busca = screen.getByRole('link', { name: 'busca' })
    expect(busca.getAttribute('href')).toBe('/?q=sol&page=2#topo')
    expect(busca.getAttributeNames().sort()).toEqual(['href'])
    expect(screen.getByRole('link', { name: 'fn' }).getAttribute('href')).toBe('/?q=a&page=3')
    expect(screen.getByRole('link', { name: 'ativo' }).getAttribute('href')).toBe('/cart')
    expect(screen.getByRole('link', { name: 'inativo' }).getAttribute('href')).toBe('/login')
  })

  it('routerMock: Navigate expõe o destino montado', () => {
    renderWithProviders(<Navigate to="/nfts/$nftId" params={{ nftId: 'n1' }} search={{ edition: '1/10' }} replace />)
    expect(screen.getByTestId('navigate').textContent).toBe('/nfts/n1?edition=1%2F10')
  })

  it('routerMock: useRouter, useCanGoBack, getRouteApi e Outlet existem e são controláveis', () => {
    setSearch({ q: 's' })
    setLoaderData({ id: 1 })
    setCanGoBack(true)
    const api = getRouteApi('/')
    function Probe() {
      const router = useRouter()
      return (
        <>
          <Outlet />
          <output>{JSON.stringify([useCanGoBack(), api.useSearch(), api.useLoaderData(), router.state])}</output>
          <button
            onClick={() => {
              void router.invalidate()
              router.history.back()
            }}
          >
            ir
          </button>
        </>
      )
    }
    renderWithProviders(<Probe />)
    expect(screen.getByTestId('outlet')).toBeTruthy()
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toEqual([
      true,
      { q: 's' },
      { id: 1 },
      { location: { pathname: '/', search: {}, href: '/' } },
    ])
    screen.getByRole('button', { name: 'ir' }).click()
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    expect(historyBackSpy).toHaveBeenCalledTimes(1)
  })
})
