// @vitest-environment jsdom
import { queryOptions } from '@tanstack/react-query'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Wallet } from '@/contracts'
import { renderWithProviders } from '@/test/render'
import { ANA, sessionOf } from '@/test/session'
import { Route } from './wallets'

const { useSession, fetchWallets } = vi.hoisted(() => ({ useSession: vi.fn(), fetchWallets: vi.fn() }))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  const mock = (await import('@/test/routerMock')).routerMock()
  return { ...actual, ...mock, createFileRoute: actual.createFileRoute }
})
vi.mock('@/auth/useSession', () => ({ useSession }))
vi.mock('@/api/wallets', () => ({
  walletsQuery: (accountId: string) => queryOptions({ queryKey: ['wallets', accountId], queryFn: fetchWallets }),
}))
vi.mock('@/features/account/WalletList', () => ({
  WalletList: ({ accountId, wallets }: { accountId: string; wallets: Wallet[] }) => <p>lista de {accountId}: {wallets.length}</p>,
  WalletListSkeleton: () => <p>skeleton das carteiras</p>,
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

  it('carregando: skeleton da lista e o formulário de adicionar', () => {
    fetchWallets.mockReturnValue(new Promise(() => undefined))
    const Component = options.component
    renderWithProviders(<Component />)
    expect(screen.getByRole('heading', { level: 1, name: 'Carteiras' })).toBeTruthy()
    expect(screen.getByText('skeleton das carteiras')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Adicionar carteira' })).toBeTruthy()
    expect(screen.getByText('form de user-ana')).toBeTruthy()
  })

  it('com as carteiras carregadas mostra a lista da conta', async () => {
    fetchWallets.mockResolvedValue([WALLET])
    const Component = options.component
    renderWithProviders(<Component />)
    expect(await screen.findByText('lista de user-ana: 1')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Suas carteiras' })).toBeTruthy()
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
    expect(screen.getByText('skeleton das carteiras')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Adicionar carteira' })).toBeNull()
    await waitFor(() => expect(fetchWallets).not.toHaveBeenCalled())
  })
})
