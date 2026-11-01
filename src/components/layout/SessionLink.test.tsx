// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { setLocation } from '@/test/routerMock'
import { ANA, sessionOf } from '@/test/session'
import { SessionLink } from './SessionLink'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
vi.mock('@/auth/useSession', () => ({ useSession }))

beforeEach(() => {
  useSession.mockReset().mockReturnValue(sessionOf(null))
  setLocation({ pathname: '/nfts/x', href: '/nfts/x?a=1', search: {} })
})

describe('SessionLink', () => {
  it('visitante: "Entrar" para /login com o lugar atual no redirect', () => {
    renderWithProviders(<SessionLink className="c" />)
    const link = screen.getByRole('link', { name: 'Entrar' })
    expect(link.getAttribute('href')).toBe('/login?redirect=%2Fnfts%2Fx%3Fa%3D1')
    expect(link.className).toBe('c')
  })

  it('em /login preserva o redirect que já está lá', () => {
    setLocation({ pathname: '/login', href: '/login?redirect=%2Fcart', search: { redirect: '/cart' } })
    renderWithProviders(<SessionLink />)
    expect(screen.getByRole('link', { name: 'Entrar' }).getAttribute('href')).toBe('/login?redirect=%2Fcart')
  })

  it('logado: nome da conta apontando para /profile', () => {
    useSession.mockReturnValue(sessionOf(ANA))
    renderWithProviders(<SessionLink />)
    expect(screen.getByRole('link', { name: 'Ana Souza' }).getAttribute('href')).toBe('/profile')
  })

  it('carregando: placeholder, sem link', () => {
    useSession.mockReturnValue({ account: undefined, isAuthenticated: false, isPending: true })
    const { container } = renderWithProviders(<SessionLink loadingClassName="w-20" />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(container.querySelector('[aria-hidden="true"]')?.className).toContain('w-20')
  })

  it('children recebe o rótulo', () => {
    useSession.mockReturnValue(sessionOf(ANA))
    renderWithProviders(<SessionLink>{(label) => <b>{`Olá, ${label}`}</b>}</SessionLink>)
    expect(screen.getByText('Olá, Ana Souza')).toBeTruthy()
  })

  it('autenticado sem conta carregada ainda mostra "Entrar" no rótulo', () => {
    useSession.mockReturnValue({ account: undefined, isAuthenticated: true, isPending: false })
    renderWithProviders(<SessionLink />)
    expect(screen.getByRole('link', { name: 'Entrar' }).getAttribute('href')).toBe('/profile')
  })
})
