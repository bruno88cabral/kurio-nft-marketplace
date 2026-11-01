// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { walletKeys } from '@/api/wallets'
import { ApiError, type Wallet } from '@/contracts'
import { renderWithProviders } from '@/test/render'
import { bumpSession, guardChecks } from '@/test/sessionGuardMock'
import { WalletList, WalletListSkeleton } from './WalletList'
import { WALLET_MESSAGES } from './validation'

const { updateWallet, deleteWallet, success, error } = vi.hoisted(() => ({
  updateWallet: vi.fn(),
  deleteWallet: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/api/wallets', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api/wallets')>()), updateWallet, deleteWallet }))
vi.mock('sonner', () => ({ toast: { success, error } }))
vi.mock('@/auth/sessionGuard', async () => (await import('@/test/sessionGuardMock')).sessionGuardMock())

const PRIMARY: Wallet = { id: 'w1', address: '0x1234567890abcdef1234567890abcdef12345678', network: 'ethereum', role: 'primary', label: 'Principal ETH' }
const RESERVE: Wallet = { id: 'w2', address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', network: 'polygon', role: 'secondary', label: 'Cofre' }

const trigger = (label: string) => screen.getByRole('button', { name: `Ações da carteira ${label}` })
function openMenu(label: string) {
  trigger(label).focus()
  fireEvent.keyDown(trigger(label), { key: 'Enter' })
}
const choose = (label: string, item: string) => {
  openMenu(label)
  fireEvent.click(screen.getByRole('menuitem', { name: item }))
}
const live = () => document.querySelector('[aria-live="polite"]')?.textContent

function setup(wallets: Wallet[] = [RESERVE, PRIMARY]) {
  return renderWithProviders(<WalletList accountId="user-ana" wallets={wallets} />)
}

beforeEach(() => {
  for (const fn of [updateWallet, deleteWallet, success, error]) fn.mockReset()
})

describe('WalletList: exibição', () => {
  it('lista a principal primeiro; só a reserva oferece "Definir como principal"', () => {
    setup()
    const names = screen.getAllByRole('listitem').map((li) => li.querySelector('.font-medium')?.textContent)
    expect(names).toEqual(['Principal ETH', 'Cofre'])
    openMenu('Principal ETH')
    expect(screen.queryByRole('menuitem', { name: 'Definir como principal' })).toBeNull()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
  })

  it('o item "Ver no Etherscan" está desabilitado (fora de escopo)', () => {
    setup()
    openMenu('Cofre')
    expect(screen.getByRole('menuitem', { name: /Ver no Etherscan/ }).getAttribute('aria-disabled')).toBe('true')
  })

  it('sem carteiras mostra o estado vazio', () => {
    setup([])
    expect(screen.getByText('Você ainda não adicionou uma carteira.')).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('só com a principal avisa que não há secundária', () => {
    setup([PRIMARY])
    expect(screen.getByText('Você ainda não adicionou uma carteira secundária.')).toBeTruthy()
  })

  it('com duas carteiras não mostra o aviso de secundária', () => {
    setup()
    expect(screen.queryByText('Você ainda não adicionou uma carteira secundária.')).toBeNull()
  })

  it('skeleton é decorativo', () => {
    const { container } = renderWithProviders(<WalletListSkeleton />)
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('WalletList: definir como principal', () => {
  it('sucesso: invalida lista e perfil, avisa por toast e pela região viva', async () => {
    updateWallet.mockResolvedValue({})
    const { queryClient } = setup()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    choose('Cofre', 'Definir como principal')
    await waitFor(() => expect(success).toHaveBeenCalledWith(WALLET_MESSAGES.promoted))
    expect(updateWallet).toHaveBeenCalledWith('w2', { role: 'primary' })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: walletKeys.list('user-ana') })
    expect(live()).toBe(WALLET_MESSAGES.promoted)
  })

  it('durante a ação todos os cards ficam com aria-busy', async () => {
    updateWallet.mockReturnValue(new Promise(() => undefined))
    const { container } = setup()
    choose('Cofre', 'Definir como principal')
    await waitFor(() => expect(container.querySelectorAll('[data-slot="wallet-card"][aria-busy="true"]')).toHaveLength(2))
  })

  it('falha mostra o toast de erro e anuncia', async () => {
    updateWallet.mockRejectedValue(new ApiError({ code: 'transient', message: 'x' }, 503))
    setup()
    choose('Cofre', 'Definir como principal')
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1))
    expect(live()).toBe(error.mock.calls[0]?.[0])
    expect(success).not.toHaveBeenCalled()
  })

  it('401 não mostra toast (o ciclo de vida avisa)', async () => {
    updateWallet.mockRejectedValue(new ApiError({ code: 'unauthorized', message: 'x' }, 401))
    setup()
    choose('Cofre', 'Definir como principal')
    await waitFor(() => expect(updateWallet).toHaveBeenCalled())
    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull())
    expect(error).not.toHaveBeenCalled()
    expect(live()).toBe('')
  })

  it('sessão trocada com a request em voo: sem toast, anúncio nem invalidação (sucesso)', async () => {
    let resolve!: (w: unknown) => void
    updateWallet.mockReturnValue(new Promise((r) => (resolve = r)))
    const { queryClient, container } = setup()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    choose('Cofre', 'Definir como principal')
    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeTruthy())
    bumpSession()
    resolve({})
    await waitFor(() => expect(guardChecks()).toEqual([false]))
    expect(success).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
    expect(live()).toBe('')
  })

  it('sessão trocada com a request em voo: a falha também é ignorada', async () => {
    let reject!: (e: unknown) => void
    updateWallet.mockReturnValue(new Promise((_, r) => (reject = r)))
    const { container } = setup()
    choose('Cofre', 'Definir como principal')
    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeTruthy())
    bumpSession()
    reject(new Error('x'))
    await waitFor(() => expect(guardChecks()).toEqual([false]))
    expect(error).not.toHaveBeenCalled()
  })
})

describe('WalletList: renomear', () => {
  it('abre o diálogo com a carteira, salva, anuncia e devolve o foco ao gatilho', async () => {
    updateWallet.mockResolvedValue({})
    setup()
    choose('Cofre', 'Renomear')
    const apelido = await screen.findByLabelText<HTMLInputElement>(/^Apelido/)
    expect(apelido.value).toBe('Cofre')
    fireEvent.change(apelido, { target: { value: 'Reserva nova' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(live()).toBe(WALLET_MESSAGES.renamed))
    expect(updateWallet).toHaveBeenCalledWith('w2', { label: 'Reserva nova' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger('Cofre')))
  })

  it('Escape fecha o diálogo e o foco volta ao gatilho "Ações"', async () => {
    setup()
    choose('Cofre', 'Renomear')
    await screen.findByRole('dialog')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger('Cofre')))
  })
})

describe('WalletList: remover', () => {
  it('pede confirmação; cancelar não remove e devolve o foco ao gatilho', async () => {
    setup()
    choose('Cofre', 'Remover')
    expect(await screen.findByRole('dialog', { name: 'Remover a carteira Cofre?' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(deleteWallet).not.toHaveBeenCalled()
    await waitFor(() => expect(document.activeElement).toBe(trigger('Cofre')))
  })

  it('confirmar remove, invalida, avisa, fecha e leva o foco para a lista', async () => {
    let resolve!: () => void
    deleteWallet.mockReturnValue(new Promise<void>((r) => (resolve = r)))
    const { queryClient } = setup()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    choose('Cofre', 'Remover')
    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }))
    expect(await screen.findByRole('button', { name: /Removendo/ })).toBeTruthy()
    // Escape é ignorado enquanto remove
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeTruthy()
    resolve()
    await waitFor(() => expect(success).toHaveBeenCalledWith(WALLET_MESSAGES.removed))
    expect(deleteWallet).toHaveBeenCalledWith('w2')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: walletKeys.list('user-ana') })
    expect(live()).toBe(WALLET_MESSAGES.removed)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('group', { name: 'Suas carteiras' })))
  })

  it('falha fecha o diálogo e mostra o toast de erro', async () => {
    deleteWallet.mockRejectedValue(new ApiError({ code: 'transient', message: 'x' }, 503))
    setup()
    choose('Cofre', 'Remover')
    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }))
    await waitFor(() => expect(error).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(success).not.toHaveBeenCalled()
  })

  it('sessão trocada com a request em voo: sem toast nem invalidação (sucesso)', async () => {
    let resolve!: () => void
    deleteWallet.mockReturnValueOnce(new Promise<void>((r) => (resolve = r)))
    const { queryClient } = setup()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    choose('Cofre', 'Remover')
    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }))
    await screen.findByRole('button', { name: /Removendo/ })
    bumpSession()
    resolve()
    await waitFor(() => expect(guardChecks()).toEqual([false]))
    expect(success).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('sessão trocada com a request em voo: a falha não mostra toast', async () => {
    let reject!: (e: unknown) => void
    deleteWallet.mockReturnValueOnce(new Promise<void>((_, r) => (reject = r)))
    setup()
    choose('Cofre', 'Remover')
    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }))
    await screen.findByRole('button', { name: /Removendo/ })
    bumpSession()
    reject(new Error('x'))
    await waitFor(() => expect(guardChecks()).toEqual([false]))
    expect(error).not.toHaveBeenCalled()
  })
})
