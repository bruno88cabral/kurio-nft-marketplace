// @vitest-environment jsdom
import { queryOptions } from '@tanstack/react-query'
import { act, fireEvent, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Wallet } from '@/contracts'
import { renderWithProviders } from '@/test/render'
import { ANA, sessionOf } from '@/test/session'
import { Route } from './wallets'

const { useSession, fetchWallets } = vi.hoisted(() => ({ useSession: vi.fn(), fetchWallets: vi.fn() }))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return (await import('@/test/routerMock')).routeModuleMock(actual)
})
vi.mock('@/auth/useSession', () => ({ useSession }))
vi.mock('@/api/wallets', () => ({
  walletsQuery: (accountId: string) => queryOptions({ queryKey: ['wallets', accountId], queryFn: fetchWallets }),
}))
vi.mock('@/features/account/WalletList', () => ({
  WalletList: ({ accountId, wallets, error, form }: { accountId: string; wallets?: Wallet[]; error?: ReactNode; form: ReactNode }) => (
    <div>
      <p>{wallets ? `lista de ${accountId}: ${wallets.length}` : 'carregando as carteiras'}</p>
      {error}
      {form}
    </div>
  ),
}))
vi.mock('@/features/account/WalletForm', () => ({ WalletForm: ({ accountId }: { accountId: string }) => <p>form de {accountId}</p> }))

const options = Route.options as unknown as { head: () => { meta: { title: string }[] }; component: () => React.ReactNode }
const WALLET: Wallet = { id: 'w1', address: '0x1234567890abcdef1234567890abcdef12345678', network: 'ethereum', role: 'primary', label: 'Principal' }

beforeEach(() => {
  useSession.mockReset().mockReturnValue(sessionOf(ANA))
  fetchWallets.mockReset()
})

describe('rota /wallets', () => {
  it('head define o título', () => {
    expect(options.head().meta).toEqual([{ title: 'Carteiras · Kurio' }])
  })

  it('carregando: h1 só para o leitor de tela, a lista sem dados e o formulário de adicionar', () => {
    fetchWallets.mockReturnValue(new Promise(() => undefined))
    const Component = options.component
    renderWithProviders(<Component />)
    expect(screen.getByRole('heading', { level: 1, name: 'Carteiras' }).className).toContain('sr-only')
    expect(screen.getByText('carregando as carteiras')).toBeTruthy()
    expect(screen.getByText('form de user-ana')).toBeTruthy()
  })

  it('com as carteiras carregadas mostra a lista da conta', async () => {
    fetchWallets.mockResolvedValue([WALLET])
    const Component = options.component
    renderWithProviders(<Component />)
    expect(await screen.findByText('lista de user-ana: 1')).toBeTruthy()
    expect(screen.queryByText('Não foi possível carregar suas carteiras.')).toBeNull()
  })

  it('erro: mostra o estado de erro e "Tentar novamente" refaz a busca', async () => {
    fetchWallets.mockRejectedValueOnce(new Error('falhou')).mockResolvedValue([WALLET])
    const Component = options.component
    renderWithProviders(<Component />)
    expect(await screen.findByText('Não foi possível carregar suas carteiras.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }))
    expect(await screen.findByText('lista de user-ana: 1')).toBeTruthy()
    expect(fetchWallets).toHaveBeenCalledTimes(2)
  })

  it('sem conta na sessão (logout em curso) não busca nem mostra o formulário', async () => {
    useSession.mockReturnValue(sessionOf(null))
    const Component = options.component
    renderWithProviders(<Component />)
    expect(screen.getByRole('heading', { level: 1, name: 'Carteiras' })).toBeTruthy()
    expect(screen.queryByText('carregando as carteiras')).toBeNull()
    expect(screen.queryByText('form de user-ana')).toBeNull()
    await act(async () => {}) // deixa efeitos e microtarefas assentarem antes da asserção negativa
    expect(fetchWallets).not.toHaveBeenCalled()
  })
})
