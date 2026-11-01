// @vitest-environment jsdom
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { installDomPolyfills } from './dom'
import { createTestQueryClient, renderWithProviders } from './render'
import { navigateSpy, setLocation, setParams, setSearch } from './routerMock'
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
    window.ResizeObserver = X
    installDomPolyfills()
    expect(window.ResizeObserver).toBe(X)
    expect(window.matchMedia('(min-width: 1px)').matches).toBe(false)
  })
})
