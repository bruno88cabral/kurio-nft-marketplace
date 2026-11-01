// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Wallet } from '@/contracts'
import { renderWithProviders } from '@/test/render'
import { WalletList } from './WalletList'

const { remove } = vi.hoisted(() => ({ remove: vi.fn() }))

vi.mock('@/api/wallets', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api/wallets')>()), deleteWallet: remove }))
// Diálogos simulados: chamam os callbacks da lista nos caminhos que o Radix real não percorre
vi.mock('./WalletDialogs', () => ({
  RenameWalletDialog: (p: { open: boolean; onOpenChange: (o: boolean) => void; onCloseAutoFocus: (e: Event) => void }) => (
    <div>
      <p>rename {String(p.open)}</p>
      <button onClick={() => p.onOpenChange(true)}>abrir rename</button>
      <button onClick={() => p.onCloseAutoFocus(new Event('x', { cancelable: true }))}>fechar rename</button>
    </div>
  ),
  RemoveWalletDialog: (p: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void }) => (
    <div>
      <p>remove {String(p.open)}</p>
      <button onClick={() => p.onOpenChange(true)}>abrir remove</button>
      <button onClick={p.onConfirm}>confirmar sem alvo</button>
    </div>
  ),
}))

const WALLET: Wallet = { id: 'w1', address: '0x1234567890abcdef1234567890abcdef12345678', network: 'ethereum', role: 'primary', label: 'Principal' }

describe('WalletList: callbacks dos diálogos', () => {
  it('abrir pelo próprio diálogo marca o tipo; confirmar sem alvo não remove; fechar sem alvo foca a lista', () => {
    renderWithProviders(<WalletList accountId="user-ana" wallets={[WALLET]} form={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'abrir rename' }))
    expect(screen.getByText('rename true')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'abrir remove' }))
    expect(screen.getByText('remove true')).toBeTruthy()
    expect(screen.getByText('rename false')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'confirmar sem alvo' }))
    expect(remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'fechar rename' }))
    expect(document.activeElement).toBe(screen.getByRole('group', { name: 'Suas carteiras' }))
  })
})
