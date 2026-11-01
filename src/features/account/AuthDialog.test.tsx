// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { navigateSpy } from '@/test/routerMock'
import { sessionOf, ANA } from '@/test/session'
import { AuthDialog, FormAlert } from './AuthDialog'

const { useSession, getMatchedRoutes } = vi.hoisted(() => ({ useSession: vi.fn(), getMatchedRoutes: vi.fn() }))

vi.mock('@tanstack/react-router', async () => {
  const mod = (await import('@/test/routerMock')).routerMock()
  return { ...mod, useRouter: () => ({ ...mod.useRouter(), getMatchedRoutes }) }
})
vi.mock('@/auth/useSession', () => ({ useSession }))
// Fundo do Início: tem as próprias queries, fora do escopo deste teste
vi.mock('@/features/catalog/HeroFeatured', () => ({ HeroFeatured: () => <p>hero</p> }))
vi.mock('@/features/catalog/PromoCards', () => ({ PromoCards: () => <p>promo</p> }))
vi.mock('@/features/catalog/MintJournal', () => ({ MintJournal: () => <p>journal</p> }))

const PROTEGIDA = [[{ id: '__root__' }, { id: '/_authenticated' }]]
const PUBLICA = [[{ id: '__root__' }]]

function open(redirect?: string) {
  return renderWithProviders(
    <AuthDialog title="Entrar" description="Acesse sua conta." redirect={redirect}>
      <input aria-label="campo" />
    </AuthDialog>,
  )
}

beforeEach(() => {
  useSession.mockReset().mockReturnValue(sessionOf(null))
  getMatchedRoutes.mockReset().mockReturnValue(PUBLICA)
})

describe('AuthDialog', () => {
  it('abre como diálogo com título, descrição, conteúdo e o fundo do Início', () => {
    open()
    const dialog = screen.getByRole('dialog', { name: 'Entrar' })
    expect(dialog.textContent).toContain('Acesse sua conta.')
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeTruthy()
    expect(screen.getByLabelText('campo')).toBeTruthy()
    expect(document.body.textContent).toContain('hero')
    expect(document.body.textContent).toContain('promo')
    expect(document.body.textContent).toContain('journal')
  })

  it('Escape sem redirect navega para / (replace)', () => {
    open()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(navigateSpy).toHaveBeenCalledWith({ href: '/', replace: true })
  })

  it('Escape com redirect público navega para o redirect', () => {
    open('/cart')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(getMatchedRoutes).toHaveBeenCalledWith('/cart')
    expect(navigateSpy).toHaveBeenCalledWith({ href: '/cart', replace: true })
  })

  it('visitante que fecha com redirect protegido vai para /', () => {
    getMatchedRoutes.mockReturnValue(PROTEGIDA)
    open('/profile')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(navigateSpy).toHaveBeenCalledWith({ href: '/', replace: true })
  })

  it('já autenticado fecha para o redirect protegido', () => {
    useSession.mockReturnValue(sessionOf(ANA))
    getMatchedRoutes.mockReturnValue(PROTEGIDA)
    open('/profile')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(navigateSpy).toHaveBeenCalledWith({ href: '/profile', replace: true })
  })

  it('o botão de fechar também navega', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /fechar/i }))
    expect(navigateSpy).toHaveBeenCalledWith({ href: '/', replace: true })
  })
})

describe('FormAlert', () => {
  it('com mensagem é um alerta; sem mensagem não renderiza nada', () => {
    const { rerender } = renderWithProviders(<FormAlert message="Falhou." />)
    expect(screen.getByRole('alert').textContent).toBe('Falhou.')
    rerender(<FormAlert message={undefined} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
