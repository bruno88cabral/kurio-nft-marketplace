// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { AccountSidebar } from './AccountSidebar'

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())

describe('AccountSidebar', () => {
  it('perfil ativo: aria-current só em "Dados do perfil"; carteiras aponta para /wallets', () => {
    renderWithProviders(<AccountSidebar active="profile" onLogout={() => undefined} className="c" />)
    const profile = screen.getByRole('link', { name: 'Dados do perfil' })
    const wallets = screen.getByRole('link', { name: 'Carteiras' })
    expect(profile.getAttribute('aria-current')).toBe('page')
    expect(profile.getAttribute('href')).toBe('/profile')
    expect(wallets.getAttribute('aria-current')).toBeNull()
    expect(wallets.getAttribute('href')).toBe('/wallets')
  })

  it('carteiras ativa inverte o aria-current', () => {
    renderWithProviders(<AccountSidebar active="wallets" onLogout={() => undefined} />)
    expect(screen.getByRole('link', { name: 'Carteiras' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Dados do perfil' }).getAttribute('aria-current')).toBeNull()
  })

  it('os itens fora de escopo são botões sem link', () => {
    renderWithProviders(<AccountSidebar active="profile" onLogout={() => undefined} />)
    for (const name of [/Atividade/, /Lista de interesse/, /Ofertas/, /Arquivos baixados/, /Suporte/]) {
      expect(screen.getByRole('button', { name })).toBeTruthy()
    }
  })

  it('"Sair" chama onLogout e desabilita durante o logout', () => {
    const onLogout = vi.fn()
    const { unmount } = renderWithProviders(<AccountSidebar active="profile" onLogout={onLogout} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(onLogout).toHaveBeenCalledTimes(1)
    unmount()
    renderWithProviders(<AccountSidebar active="profile" onLogout={onLogout} loggingOut />)
    expect((screen.getByRole<HTMLButtonElement>('button', { name: 'Sair' })).disabled).toBe(true)
  })
})
