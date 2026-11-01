// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type Nft } from '@/contracts'
import { parseEth } from '@/lib/eth'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}))

const { CartLine } = await import('./CartLine')

const nft: Nft = {
  id: 'nft-027',
  name: 'Crease Nova',
  imageUrl: '/nfts/crease-nova.svg',
  images: ['/nfts/crease-nova.svg'],
  collection: 'Paper Comets',
  description: '',
  creator: 'x',
  network: 'optimism',
  price: parseEth('1.35'),
  editions: [{ kind: '1/50', available: 3, total: 50 }],
  createdAt: '2026-01-01T00:00:00.000Z',
  featured: false,
}

const props = {
  item: { nftId: 'nft-027', edition: '1/50' as const, quantity: 3 },
  nft,
  unitPrice: nft.price,
  onQuantityChange: () => Promise.resolve(),
  onRemove: () => Promise.resolve(),
}

afterEach(cleanup)

describe('CartLine', () => {
  it('o stepper limita a quantidade ao estoque da edição', () => {
    const onQuantityChange = vi.fn(() => Promise.resolve())
    render(<ul><CartLine {...props} onQuantityChange={onQuantityChange} /></ul>)
    const input = screen.getByRole<HTMLInputElement>('textbox')
    expect(screen.getByText('Máximo: 3')).toBeTruthy()
    fireEvent.change(input, { target: { value: '99' } })
    fireEvent.blur(input)
    // 99 vira 3 (= valor atual): nada é enviado
    expect(onQuantityChange).not.toHaveBeenCalled()
    expect(input.value).toBe('3')
  })

  it('o 409 do PATCH aparece na própria linha com o texto da API', async () => {
    const onQuantityChange = vi.fn(() => Promise.reject(new ApiError({ code: 'conflict', message: 'Só restam 2.' }, 409)))
    render(<ul><CartLine {...props} item={{ ...props.item, quantity: 2 }} onQuantityChange={onQuantityChange} /></ul>)
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Só restam 2.')
    await waitFor(() => expect(screen.getByRole('listitem').getAttribute('aria-busy')).toBeNull())
  })

  it('marca a linha com "Indisponível" quando a cotação traz o problema', () => {
    render(<ul><CartLine {...props} issue="unavailable" /></ul>)
    expect(screen.getByText('Indisponível')).toBeTruthy()
  })

  it('a lixeira é só ícone, com o nome do item e da edição', () => {
    render(<ul><CartLine {...props} /></ul>)
    const remove = screen.getByRole('button', { name: 'Remover Crease Nova, Edição 1/50' })
    expect(remove.textContent).toBe('')
  })

  it('mostra o preço unitário e o total da linha (`unitPrice × quantity`, só exibição)', () => {
    render(<ul><CartLine {...props} /></ul>)
    expect(screen.getByText('1.35 ETH')).toBeTruthy()
    expect(screen.getByText('4.05 ETH')).toBeTruthy()
    expect(screen.getByText('Edição: 1/50')).toBeTruthy()
  })
})
