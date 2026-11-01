// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { walletKeys } from '@/api/wallets'
import { ApiError, type Wallet } from '@/contracts'
import { renderWithProviders } from '@/test/render'
import { RemoveWalletDialog, RenameWalletDialog } from './WalletDialogs'
import { WALLET_MESSAGES } from './validation'

const { updateWallet, success } = vi.hoisted(() => ({ updateWallet: vi.fn(), success: vi.fn() }))

vi.mock('@/api/wallets', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api/wallets')>()), updateWallet }))
vi.mock('sonner', () => ({ toast: { success } }))

const PRIMARY: Wallet = { id: 'w1', address: '0x1234567890abcdef1234567890abcdef12345678', network: 'ethereum', role: 'primary', label: 'Principal ETH' }
const RESERVE: Wallet = { id: 'w2', address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', network: 'polygon', role: 'secondary', label: 'Cofre' }

const apelido = () => screen.getByLabelText<HTMLInputElement>(/^Apelido/)
const type = (value: string) => fireEvent.change(apelido(), { target: { value } })
const save = () => fireEvent.click(screen.getByRole('button', { name: /^Salvar|^Salvando/ }))

beforeEach(() => {
  updateWallet.mockReset()
  success.mockReset()
})

describe('RenameWalletDialog', () => {
  const setup = (wallet: Wallet | undefined) => {
    const onOpenChange = vi.fn()
    const onRenamed = vi.fn()
    const onCloseAutoFocus = vi.fn()
    const view = renderWithProviders(
      <RenameWalletDialog
        wallet={wallet}
        open
        onOpenChange={onOpenChange}
        accountId="user-ana"
        onRenamed={onRenamed}
        onCloseAutoFocus={onCloseAutoFocus}
      />,
    )
    return { ...view, onOpenChange, onRenamed }
  }

  it('mostra o título, o resumo da carteira e o apelido atual', () => {
    setup(PRIMARY)
    expect(screen.getByRole('dialog', { name: 'Renomear carteira' })).toBeTruthy()
    expect(screen.getByText('0x1234…5678 · Ethereum')).toBeTruthy()
    expect(apelido().value).toBe('Principal ETH')
    expect(screen.getByText('13 de 40 caracteres')).toBeTruthy()
  })

  it('selecionar o texto ao focar o campo', () => {
    setup(PRIMARY)
    const select = vi.spyOn(apelido(), 'select')
    fireEvent.focus(apelido())
    expect(select).toHaveBeenCalled()
  })

  it('apelido vazio ou longo demais mostra erro e não envia', () => {
    setup(PRIMARY)
    type('   ')
    save()
    expect(screen.getByText('Informe um apelido.')).toBeTruthy()
    type('x'.repeat(41))
    save()
    expect(screen.getByText('Use até 40 caracteres.')).toBeTruthy()
    expect(updateWallet).not.toHaveBeenCalled()
  })

  it('salvar envia o apelido sem espaços, invalida, avisa, fecha e anuncia', async () => {
    updateWallet.mockResolvedValue({})
    const { queryClient, onOpenChange, onRenamed } = setup(PRIMARY)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    type('  Nova ')
    save()
    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith(WALLET_MESSAGES.renamed))
    expect(updateWallet).toHaveBeenCalledWith('w1', { label: 'Nova' })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: walletKeys.list('user-ana') })
    expect(success).toHaveBeenCalledWith(WALLET_MESSAGES.renamed)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('durante o envio mostra "Salvando…" desabilitado', async () => {
    updateWallet.mockReturnValue(new Promise(() => undefined))
    setup(PRIMARY)
    type('Nova')
    save()
    const button = await screen.findByRole<HTMLButtonElement>('button', { name: /Salvando/ })
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
  })

  it('422 do servidor volta no campo e o diálogo continua aberto', async () => {
    updateWallet.mockRejectedValue(new ApiError({ code: 'validation', message: 'x', fieldErrors: { label: 'Apelido repetido' } }, 422))
    const { onOpenChange } = setup(PRIMARY)
    type('Nova')
    save()
    expect(await screen.findByText('Apelido repetido')).toBeTruthy()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('"Cancelar" pede o fechamento', () => {
    const { onOpenChange } = setup(PRIMARY)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('abrir para outra carteira recomeça com o apelido dela', () => {
    const { rerender, onOpenChange, onRenamed, queryClient } = setup(PRIMARY)
    type('rascunho')
    rerender(
      <QueryClientProvider client={queryClient}>
        <RenameWalletDialog wallet={RESERVE} open onOpenChange={onOpenChange} accountId="user-ana" onRenamed={onRenamed} />
      </QueryClientProvider>,
    )
    expect(apelido().value).toBe('Cofre')
  })

  it('sem carteira não há formulário', () => {
    setup(undefined)
    expect(screen.queryByLabelText(/^Apelido/)).toBeNull()
  })
})

describe('RemoveWalletDialog', () => {
  const setup = (props: Partial<React.ComponentProps<typeof RemoveWalletDialog>> = {}) => {
    const onOpenChange = vi.fn()
    const onConfirm = vi.fn()
    const view = renderWithProviders(
      <RemoveWalletDialog
        wallet={RESERVE}
        open
        onOpenChange={onOpenChange}
        hasOthers
        removing={false}
        onConfirm={onConfirm}
        {...props}
      />,
    )
    return { ...view, onOpenChange, onConfirm }
  }

  it('pede confirmação com o resumo e sem o aviso da principal para uma reserva', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Remover a carteira Cofre?' })).toBeTruthy()
    expect(screen.getByText(/0xabcd…abcd · Polygon\. Ela deixa de aparecer no Pagamento\./).textContent).not.toContain('Outra carteira')
  })

  it('principal com outras carteiras avisa que outra assume; sozinha não', () => {
    const { unmount } = setup({ wallet: PRIMARY })
    expect(screen.getByText(/Outra carteira passa a ser a principal\./)).toBeTruthy()
    unmount()
    setup({ wallet: PRIMARY, hasOthers: false })
    expect(screen.queryByText(/Outra carteira passa/)).toBeNull()
  })

  it('"Remover" confirma e "Cancelar" fecha', () => {
    const { onConfirm, onOpenChange } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('Escape fecha', () => {
    const { onOpenChange } = setup()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('removendo: botões desabilitados, "Removendo…" e Escape ignorado', () => {
    const { onOpenChange } = setup({ removing: true })
    const button = screen.getByRole<HTMLButtonElement>('button', { name: /Removendo/ })
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancelar' }).disabled).toBe(true)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('sem carteira não há conteúdo', () => {
    setup({ wallet: undefined })
    expect(screen.queryByRole('button', { name: 'Remover' })).toBeNull()
  })
})
