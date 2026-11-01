// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { AccountLayout } from './AccountLayout'
import { AccountPanel } from './AccountPanel'

const { useSignOut, signOut } = vi.hoisted(() => ({ useSignOut: vi.fn(), signOut: vi.fn() }))

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
vi.mock('./useSignOut', () => ({ useSignOut }))

beforeEach(() => {
  signOut.mockReset().mockResolvedValue(undefined)
  useSignOut.mockReset().mockReturnValue({ signOut, pending: false })
})

describe('AccountLayout', () => {
  it('mostra o título (único h1), a descrição e o conteúdo', () => {
    renderWithProviders(
      <AccountLayout active="profile" title="Perfil" description="Seus dados.">
        <p>conteudo</p>
      </AccountLayout>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Perfil' })).toBeTruthy()
    expect(screen.getByText('Seus dados.')).toBeTruthy()
    expect(screen.getByText('conteudo')).toBeTruthy()
  })

  it('sem descrição não renderiza o parágrafo', () => {
    const { container } = renderWithProviders(
      <AccountLayout active="wallets" title="Carteiras">
        <p>x</p>
      </AccountLayout>,
    )
    expect(container.querySelector('header p')).toBeNull()
  })

  it('navegação: sidebar e abas apontam para Perfil e Carteiras, com a ativa marcada', () => {
    renderWithProviders(
      <AccountLayout active="wallets" title="Carteiras">
        <p>x</p>
      </AccountLayout>,
    )
    const navs = screen.getAllByRole('navigation', { name: 'Conta' })
    expect(navs).toHaveLength(2)
    const tabs = screen.getByRole('link', { name: 'Perfil' })
    expect(tabs.getAttribute('href')).toBe('/profile')
    expect(tabs.getAttribute('aria-current')).toBeNull()
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
    for (const button of screen.getAllByRole('button', { name: 'Sair' })) fireEvent.click(button)
    expect(signOut).toHaveBeenCalledTimes(2)
  })

  it('durante o logout os botões ficam desabilitados e mostram "Saindo…"', () => {
    useSignOut.mockReturnValue({ signOut, pending: true })
    renderWithProviders(
      <AccountLayout active="profile" title="Perfil">
        <p>x</p>
      </AccountLayout>,
    )
    const saindo = screen.getByRole<HTMLButtonElement>('button', { name: 'Saindo…' })
    expect(saindo.disabled).toBe(true)
    expect(saindo.getAttribute('aria-busy')).toBe('true')
    expect((screen.getByRole<HTMLButtonElement>('button', { name: 'Sair' })).disabled).toBe(true)
  })
})

describe('AccountPanel', () => {
  it('seção nomeada pelo h2, com descrição opcional', () => {
    renderWithProviders(
      <AccountPanel title="Dados do perfil" description="Ajuda" className="x">
        <p>filho</p>
      </AccountPanel>,
    )
    const section = screen.getByRole('region', { name: 'Dados do perfil' })
    expect(section.textContent).toContain('Ajuda')
    expect(screen.getByText('filho')).toBeTruthy()
  })

  it('sem descrição só o título', () => {
    renderWithProviders(
      <AccountPanel title="Alterar senha">
        <p>filho</p>
      </AccountPanel>,
    )
    expect(screen.getByRole('region', { name: 'Alterar senha' }).querySelector('header p')).toBeNull()
  })
})
