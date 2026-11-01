// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIGNED_OUT_MESSAGE } from '@/features/account/useSignOut'
import { renderWithProviders } from '@/test/render'
import { navigateSpy } from '@/test/routerMock'
import { ANA, sessionOf } from '@/test/session'
import { AccountMenu } from './AccountMenu'

const { useSession, endSession, success } = vi.hoisted(() => ({ useSession: vi.fn(), endSession: vi.fn(), success: vi.fn() }))

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
vi.mock('@/auth/useSession', () => ({ useSession }))
vi.mock('@/auth/sessionLifecycle', () => ({ AUTH_ROUTES: ['/login', '/signup'], sessionLifecycle: { endSession } }))
vi.mock('sonner', () => ({ toast: { success } }))

function openMenu() {
  const trigger = screen.getByRole('button', { name: /Ana Souza/ })
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'Enter' })
  return trigger
}

beforeEach(() => {
  useSession.mockReset().mockReturnValue(sessionOf(ANA))
  endSession.mockReset().mockResolvedValue(undefined)
  success.mockReset()
  document.body.innerHTML = ''
})

describe('AccountMenu', () => {
  it('visitante vê o link "Entrar"', () => {
    useSession.mockReturnValue(sessionOf(null))
    renderWithProviders(<AccountMenu className="c" loadingClassName="l" />)
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeTruthy()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('autenticado sem a conta carregada cai no SessionLink', () => {
    useSession.mockReturnValue({ account: undefined, isAuthenticated: true, isPending: false })
    renderWithProviders(<AccountMenu />)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('link')).toBeTruthy()
  })

  it('logado: o gatilho abre o menu com nome, e-mail, Perfil e Carteiras', () => {
    renderWithProviders(<AccountMenu />)
    openMenu()
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByText('ana@kurio.test')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Perfil' }).getAttribute('href')).toBe('/profile')
    expect(screen.getByRole('menuitem', { name: 'Carteiras' }).getAttribute('href')).toBe('/wallets')
  })

  it('Escape fecha o menu e devolve o foco ao gatilho', async () => {
    renderWithProviders(<AccountMenu />)
    const trigger = openMenu()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })

  it('"Sair" encerra a sessão, avisa e volta ao Início', async () => {
    renderWithProviders(<AccountMenu />)
    openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sair' }))
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith({ to: '/' }))
    expect(endSession).toHaveBeenCalledWith('logout')
    expect(success).toHaveBeenCalledWith(SIGNED_OUT_MESSAGE)
  })

  it('enquanto sai, o item fica "Saindo…" desabilitado e o menu aberto; fechar foca o conteúdo, não o gatilho', async () => {
    let finish!: () => void
    endSession.mockReturnValue(new Promise<void>((r) => (finish = r)))
    renderWithProviders(<AccountMenu />)
    const main = document.createElement('main')
    main.id = 'conteudo'
    main.tabIndex = -1
    document.body.append(main)
    const trigger = openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sair' }))
    const item = await screen.findByRole('menuitem', { name: 'Saindo…' })
    expect(item.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(document.activeElement).toBe(main)
    expect(document.activeElement).not.toBe(trigger)
    act(() => finish())
  })
})
