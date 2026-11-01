// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Wallet } from '@/contracts'
import { renderWithProviders } from '@/test/render'
import { WalletCard, WalletCardGroup } from './WalletCard'

const PRIMARY: Wallet = { id: 'w1', address: '0x1234567890abcdef1234567890abcdef12345678', network: 'ethereum', role: 'primary', label: 'Principal ETH' }
const RESERVE: Wallet = { id: 'w2', address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', network: 'polygon', role: 'secondary', label: 'Cofre' }

function openActions(label: string) {
  const trigger = screen.getByRole('button', { name: `Ações da carteira ${label}` })
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'Enter' })
}

describe('WalletCard', () => {
  it('selecionável: rádio dentro do grupo, rótulos de papel e rede', () => {
    const onValueChange = vi.fn()
    renderWithProviders(
      <WalletCardGroup value="w1" onValueChange={onValueChange} className="g">
        <WalletCard wallet={PRIMARY} className="k" />
        <WalletCard wallet={RESERVE} ens="ana.eth" />
      </WalletCardGroup>,
    )
    expect(screen.getByRole('radiogroup', { name: 'Carteiras salvas' })).toBeTruthy()
    expect(screen.getByText('Principal')).toBeTruthy()
    expect(screen.getByText('Reserva')).toBeTruthy()
    expect(screen.getByText('Ethereum')).toBeTruthy()
    expect(screen.getByText('ana.eth')).toBeTruthy()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(2)
    expect(radios[0]?.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(radios[1])
    expect(onValueChange).toHaveBeenCalledWith('w2')
    // sem ações, sem menu
    expect(screen.queryByRole('button', { name: /Ações da carteira/ })).toBeNull()
  })

  it('o grupo aceita rótulo próprio, valor indefinido e travamento', () => {
    renderWithProviders(
      <WalletCardGroup value={undefined} onValueChange={() => undefined} label="Pagar com" disabled>
        <WalletCard wallet={PRIMARY} />
      </WalletCardGroup>,
    )
    expect(screen.getByRole('radiogroup', { name: 'Pagar com' })).toBeTruthy()
    expect(screen.getByRole('radio').getAttribute('aria-checked')).toBe('false')
    expect((screen.getByRole<HTMLButtonElement>('radio')).disabled).toBe(true)
  })

  it('não selecionável: sem rádio, endereço curto com o completo para leitores de tela', () => {
    renderWithProviders(<WalletCard wallet={PRIMARY} selectable={false} />)
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.getByText(new RegExp(`endereço ${PRIMARY.address}`))).toBeTruthy()
  })

  it('menu de ações: item comum, destrutivo e fora de escopo', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    renderWithProviders(
      <WalletCard
        wallet={PRIMARY}
        selectable={false}
        actions={[
          { label: 'Renomear', onSelect: onEdit },
          { label: 'Ver no Etherscan', outOfScope: true },
          { label: 'Remover', destructive: true, onSelect: onDelete },
        ]}
      />,
    )
    openActions('Principal ETH')
    expect(screen.getByRole('menuitem', { name: /Ver no Etherscan/ }).getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Em breve')).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remover' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('ocupado: aria-busy no card e itens desabilitados, gatilho habilitado', () => {
    const onEdit = vi.fn()
    const { container } = renderWithProviders(
      <WalletCard wallet={RESERVE} selectable={false} busy actions={[{ label: 'Renomear', onSelect: onEdit }]} />,
    )
    expect(container.querySelector('[data-slot="wallet-card"]')?.getAttribute('aria-busy')).toBe('true')
    openActions('Cofre')
    expect(screen.getByRole('menuitem', { name: 'Renomear' }).getAttribute('aria-disabled')).toBe('true')
  })

  it('livre: sem aria-busy', () => {
    const { container } = renderWithProviders(<WalletCard wallet={RESERVE} selectable={false} />)
    expect(container.querySelector('[data-slot="wallet-card"]')?.getAttribute('aria-busy')).toBeNull()
  })
})
