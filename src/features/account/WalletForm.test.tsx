// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { walletKeys } from '@/api/wallets'
import { profileKeys } from '@/api/profile'
import { ApiError } from '@/contracts'
import { renderWithProviders } from '@/test/render'
import { bumpSession, guardChecks } from '@/test/sessionGuardMock'
import { WalletForm } from './WalletForm'
import { WALLET_MESSAGES } from './validation'

const { createWallet, success } = vi.hoisted(() => ({ createWallet: vi.fn(), success: vi.fn() }))

vi.mock('@/api/wallets', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api/wallets')>()), createWallet }))
vi.mock('sonner', () => ({ toast: { success } }))
vi.mock('@/auth/sessionGuard', async () => (await import('@/test/sessionGuardMock')).sessionGuardMock())

const ADDRESS = '0x1234567890abcdef1234567890abcdef12345678'
const field = (label: string) => screen.getByLabelText<HTMLInputElement>(new RegExp(`^${label}`))
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } })
const submit = () => fireEvent.click(screen.getByRole('button', { name: /^Adicionar carteira|^Adicionando/ }))
const pickNetwork = async (name: string) => {
  fireEvent.pointerDown(screen.getByRole('combobox'), { button: 0, ctrlKey: false, pointerType: 'mouse' })
  fireEvent.click(screen.getByRole('option', { name }))
  // O Radix devolve o foco ao seletor ao fechar a lista; espera isso antes de seguir
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
}

beforeEach(() => {
  createWallet.mockReset()
  success.mockReset()
})

describe('WalletForm', () => {
  it('endereço inválido e rede vazia mostram erro, focam o endereço e não enviam', () => {
    renderWithProviders(<WalletForm accountId="user-ana" />)
    type('Endereço', '0x123')
    submit()
    expect(screen.getByText('Endereço inválido. Use 0x seguido de 40 hexadecimais.')).toBeTruthy()
    expect(screen.getByText('Selecione a rede.')).toBeTruthy()
    expect(document.activeElement).toBe(field('Endereço'))
    expect(createWallet).not.toHaveBeenCalled()
  })

  it('apelido com mais de 40 caracteres mostra erro e o contador acompanha', () => {
    renderWithProviders(<WalletForm accountId="user-ana" />)
    type('Apelido', 'x'.repeat(41))
    expect(screen.getByText(/^41 de 40 caracteres/)).toBeTruthy()
    submit()
    expect(screen.getByText('Use até 40 caracteres.')).toBeTruthy()
  })

  it('erro só na rede foca o seletor', () => {
    renderWithProviders(<WalletForm accountId="user-ana" />)
    type('Endereço', ADDRESS)
    submit()
    expect(document.activeElement).toBe(screen.getByRole('combobox'))
  })

  it('sucesso: escolhe a rede, envia sem apelido vazio, limpa, invalida lista e perfil e avisa', async () => {
    createWallet.mockResolvedValue({})
    const { queryClient } = renderWithProviders(<WalletForm accountId="user-ana" />)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    type('Endereço', `  ${ADDRESS} `)
    await pickNetwork('Polygon')
    expect(screen.getByRole('combobox').textContent).toContain('Polygon')
    submit()
    await waitFor(() => expect(success).toHaveBeenCalledWith(WALLET_MESSAGES.added))
    expect(createWallet).toHaveBeenCalledWith({ address: ADDRESS, network: 'polygon', label: undefined })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: walletKeys.list('user-ana') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: profileKeys.detail('user-ana') })
    expect(field('Endereço').value).toBe('')
    expect(screen.getByRole('combobox').textContent).toContain('Selecione a rede')
  })

  it('com apelido, envia o apelido sem espaços', async () => {
    createWallet.mockResolvedValue({})
    renderWithProviders(<WalletForm accountId="user-ana" />)
    type('Endereço', ADDRESS)
    await pickNetwork('Ethereum')
    type('Apelido', '  Minha ')
    submit()
    await waitFor(() => expect(createWallet).toHaveBeenCalledWith({ address: ADDRESS, network: 'ethereum', label: 'Minha' }))
  })

  it('durante o envio mostra "Adicionando…" desabilitado', async () => {
    createWallet.mockReturnValue(new Promise(() => undefined))
    renderWithProviders(<WalletForm accountId="user-ana" />)
    type('Endereço', ADDRESS)
    await pickNetwork('Ethereum')
    submit()
    const button = await screen.findByRole<HTMLButtonElement>('button', { name: /Adicionando/ })
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
  })

  it('409 cai no endereço; 422 nos campos', async () => {
    createWallet.mockRejectedValueOnce(new ApiError({ code: 'conflict', message: 'Esta carteira já está conectada.' }, 409))
    renderWithProviders(<WalletForm accountId="user-ana" />)
    type('Endereço', ADDRESS)
    await pickNetwork('Ethereum')
    submit()
    expect(await screen.findByText('Esta carteira já está conectada.')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(field('Endereço')))
    createWallet.mockRejectedValueOnce(new ApiError({ code: 'validation', message: 'x', fieldErrors: { label: 'Apelido repetido' } }, 422))
    submit()
    expect(await screen.findByText('Apelido repetido')).toBeTruthy()
    expect(success).not.toHaveBeenCalled()
  })

  it('sessão trocada com a request em voo: sem toast, invalidação nem limpeza do formulário', async () => {
    let resolve!: (w: unknown) => void
    createWallet.mockReturnValue(new Promise((r) => (resolve = r)))
    const { queryClient } = renderWithProviders(<WalletForm accountId="user-ana" />)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    type('Endereço', ADDRESS)
    await pickNetwork('Ethereum')
    submit()
    await waitFor(() => expect(createWallet).toHaveBeenCalled())
    bumpSession()
    resolve({})
    await waitFor(() => expect(guardChecks()).toEqual([false]))
    expect(success).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
    expect(field('Endereço').value).toBe(ADDRESS)
  })
})
