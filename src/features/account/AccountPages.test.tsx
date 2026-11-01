// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { Wallet } from '@/contracts'

vi.mock('@/auth/sessionLifecycle', () => ({
  SESSION_EXPIRED_MESSAGE: 'Sua sessão expirou. Entre novamente.',
  sessionLifecycle: { captureSession: () => () => true },
}))
vi.mock('./useSignOut', () => ({ useSignOut: () => ({ signOut: vi.fn(), pending: false }) }))

const { AccountLayout } = await import('./AccountLayout')
const { WalletList } = await import('./WalletList')
const { WalletForm } = await import('./WalletForm')

const PRIMARY: Wallet = {
  id: 'w-1',
  address: '0x1111111111111111111111111111111111111111',
  network: 'ethereum',
  role: 'primary',
  label: 'Principal da Ana',
}
const RESERVE: Wallet = { ...PRIMARY, id: 'w-2', role: 'secondary', label: 'Carteira de viagem', network: 'polygon' }

afterEach(cleanup)

async function renderAt(path: string, page: ReactNode) {
  const client = new QueryClient()
  const rootRoute = createRootRoute({
    component: () => (
      <QueryClientProvider client={client}>
        <TooltipProvider>{page}</TooltipProvider>
      </QueryClientProvider>
    ),
  })
  const routes = ['/profile', '/wallets'].map((p) => createRoute({ getParentRoute: () => rootRoute, path: p }))
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(<RouterProvider router={router} />)
  return screen.findByRole('navigation', { name: 'Meu perfil' })
}

describe('AccountSidebar (Figma "Meu perfil")', () => {
  it('tem os itens do Figma na ordem, o ativo com aria-current e os sem tela como "Em breve"', async () => {
    const nav = await renderAt('/profile', <AccountLayout active="profile" title="Perfil do colecionador">conteúdo</AccountLayout>)
    const items = within(nav)
      .getAllByRole('listitem')
      .map((li) => li.textContent?.trim())
    expect(items).toEqual([
      'Dados do perfil',
      'Carteiras',
      'Atividade (em breve)',
      'Lista de interesse (em breve)',
      'Ofertas (em breve)',
      'Arquivos baixados (em breve)',
      'Suporte (em breve)',
    ])
    expect(within(nav).getByRole('link', { name: 'Dados do perfil' }).getAttribute('aria-current')).toBe('page')
    expect(within(nav).getByRole('link', { name: 'Carteiras' }).getAttribute('aria-current')).toBeNull()
    for (const name of ['Atividade', 'Lista de interesse', 'Ofertas', 'Arquivos baixados', 'Suporte']) {
      expect(within(nav).getByRole('button', { name: new RegExp(`^${name} ?\\(em breve\\)$`) }).getAttribute('aria-disabled')).toBe('true')
    }
    expect(within(nav).getByRole('button', { name: 'Sair' })).toBeTruthy()
    // Cada item tem ícone (decorativo)
    expect(nav.querySelectorAll('li svg[aria-hidden="true"]')).toHaveLength(7)
  })

  it('o título da página é o h1 pequeno "Perfil do colecionador"', async () => {
    await renderAt('/profile', <AccountLayout active="profile" title="Perfil do colecionador">conteúdo</AccountLayout>)
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Perfil do colecionador'])
  })
})

describe('Carteiras (Figma: principal e secundária, sem cards)', () => {
  const page = (wallets: Wallet[] | undefined) => (
    <AccountLayout active="wallets" title="Carteiras" hideTitle>
      <WalletList accountId="user-ana" wallets={wallets} form={<WalletForm accountId="user-ana" />} />
    </AccountLayout>
  )

  it('só com a principal: ela fica em "Carteira principal" e a secundária mostra o texto do Figma', async () => {
    await renderAt('/wallets', page([PRIMARY]))
    const primary = screen.getByRole('region', { name: 'Carteira principal' })
    expect(within(primary).getByText('Principal da Ana')).toBeTruthy()
    expect(within(primary).getByRole('form', { name: 'Nova carteira' })).toBeTruthy()
    const secondary = screen.getByRole('region', { name: 'Carteira secundária' })
    expect(within(secondary).getByText('Você ainda não adicionou uma carteira secundária.')).toBeTruthy()
    expect(within(secondary).getByRole('button', { name: /^Igual à carteira principal/ }).getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('heading', { level: 1, name: 'Carteiras' })).toBeTruthy()
  })

  it('com reserva: ela fica em "Carteira secundária", com as ações do contrato', async () => {
    await renderAt('/wallets', page([RESERVE, PRIMARY]))
    const secondary = screen.getByRole('region', { name: 'Carteira secundária' })
    expect(within(secondary).getByText('Carteira de viagem')).toBeTruthy()
    expect(within(secondary).queryByText('Você ainda não adicionou uma carteira secundária.')).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Carteira principal' })).queryByText('Carteira de viagem')).toBeNull()
  })

  it('"Adicionar" leva o foco ao primeiro campo do formulário (Rede)', async () => {
    await renderAt('/wallets', page([PRIMARY]))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar carteira' }))
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: /^Rede/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar carteira secundária' }))
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: /^Rede/ }))
  })

  it('carregando: as duas seções aparecem com o formulário, sem lista', async () => {
    await renderAt('/wallets', page(undefined))
    expect(screen.getByRole('region', { name: 'Carteira principal' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Carteira secundária' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Carteira principal' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Salvar carteira' })).toBeTruthy()
  })
})
