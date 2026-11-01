// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { AccountLayout } from './AccountLayout'

const { useSignOut, signOut } = vi.hoisted(() => ({ useSignOut: vi.fn(), signOut: vi.fn() }))

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
vi.mock('./useSignOut', () => ({ useSignOut }))

beforeEach(() => {
  signOut.mockReset().mockResolvedValue(undefined)
  useSignOut.mockReset().mockReturnValue({ signOut, pending: false })
})

describe('AccountLayout', () => {
  it('mostra o título (único h1) e o conteúdo', () => {
    renderWithProviders(
      <AccountLayout active="profile" title="Perfil">
        <p>conteudo</p>
      </AccountLayout>,
    )
    const h1 = screen.getByRole('heading', { level: 1, name: 'Perfil' })
    expect(h1.className).not.toContain('sr-only')
    expect(screen.getByText('conteudo')).toBeTruthy()
  })

  it('hideTitle deixa o h1 só para o leitor de tela', () => {
    renderWithProviders(
      <AccountLayout active="wallets" title="Carteiras" hideTitle>
        <p>x</p>
      </AccountLayout>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Carteiras' }).className).toContain('sr-only')
  })

  it('navegação: sidebar e abas apontam para Perfil e Carteiras, com a ativa marcada', () => {
    renderWithProviders(
      <AccountLayout active="wallets" title="Carteiras">
        <p>x</p>
      </AccountLayout>,
    )
    expect(screen.getByRole('navigation', { name: 'Meu perfil' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Conta' })).toBeTruthy()
    const tab = screen.getByRole('link', { name: 'Perfil' })
    expect(tab.getAttribute('href')).toBe('/profile')
    expect(tab.getAttribute('aria-current')).toBeNull()
    expect(screen.getAllByRole('link', { name: 'Carteiras' }).map((l) => l.getAttribute('aria-current'))).toEqual([
      'page',
      'page',
    ])
  })

  it('"Sair" (sidebar e abas) chama o signOut', () => {
    renderWithProviders(
      <AccountLayout active="profile" title="Perfil">
        <p>x</p>
      </AccountLayout>,
    )
    const buttons = screen.getAllByRole('button', { name: 'Sair' })
    expect(buttons).toHaveLength(2)
    for (const button of buttons) fireEvent.click(button)
    expect(signOut).toHaveBeenCalledTimes(2)
  })

  it('durante o logout os botões ficam desabilitados e mostram "Saindo…"', () => {
    useSignOut.mockReturnValue({ signOut, pending: true })
    renderWithProviders(
      <AccountLayout active="profile" title="Perfil">
        <p>x</p>
      </AccountLayout>,
    )
    const saindo = screen.getAllByRole<HTMLButtonElement>('button', { name: 'Saindo…' })
    expect(saindo).toHaveLength(2)
    for (const b of saindo) {
      expect(b.disabled).toBe(true)
      expect(b.getAttribute('aria-busy')).toBe('true')
    }
  })
})
