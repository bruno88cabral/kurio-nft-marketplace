// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Order } from '@/contracts'
import { parseEth } from '@/lib/eth'
import { OrderReceipt } from './OrderReceipt'

afterEach(cleanup)

const item = { nftId: 'nft-002', name: 'Solar Veil', edition: '1/10' as const, quantity: 2, unitPrice: parseEth('0.35') }
const order: Order = {
  id: 'o1',
  status: 'confirmed',
  idempotencyKey: 'k1',
  quoteId: 'q1',
  walletId: 'w1',
  network: 'ethereum',
  items: [item],
  receipt: { items: [item], subtotal: parseEth('0.7'), discount: parseEth('0'), networkFee: parseEth('0.002'), total: parseEth('0.702') },
  txHash: '0xabcdef0123456789abcdef0123456789abcdef01',
  explorerUrl: 'https://etherscan.io/tx/0xabc',
  createdAt: '2026-07-29T12:00:00.000Z',
  updatedAt: '2026-07-29T12:00:00.000Z',
}

describe('OrderReceipt', () => {
  it('mostra a taxa de rede cobrada, sem "Taxa estimada"', () => {
    render(<OrderReceipt order={order} />)
    expect(screen.getByText('Taxa de rede')).toBeTruthy()
    expect(screen.queryByText('Taxa estimada')).toBeNull()
    // Total na faixa de metadados e no fim da tabela
    expect(screen.getAllByText('0.702 ETH')).toHaveLength(2)
  })

  it('a linha mostra "(x N)" e o subtotal `unitPrice × quantity` do snapshot, e a edição no lugar do "ID do token"', () => {
    render(<OrderReceipt order={order} />)
    expect(screen.getByRole('heading', { name: 'Detalhes da transação' })).toBeTruthy()
    expect(screen.getByText('(x 2)')).toBeTruthy()
    expect(screen.getByText('0.7 ETH')).toBeTruthy()
    expect(screen.getByText('Edição: 1/10')).toBeTruthy()
  })

  it('faixa de metadados: transação abreviada (inteira no title), data em pt-BR e a carteira', () => {
    render(<OrderReceipt order={order} walletLabel="Carteira principal" />)
    const tx = screen.getByText('0xabcd…ef01')
    expect(tx.getAttribute('title')).toBe(order.txHash)
    expect(screen.getByText('29 jul. 2026')).toBeTruthy()
    expect(screen.getByText('Carteira principal')).toBeTruthy()
  })

  it('o desconto só aparece quando houve desconto', () => {
    const { rerender } = render(<OrderReceipt order={order} />)
    expect(screen.queryByText('Desconto')).toBeNull()
    rerender(<OrderReceipt order={{ ...order, receipt: { ...order.receipt, discount: parseEth('0.07'), total: parseEth('0.632') } }} />)
    expect(screen.getByText('(-) 0.07 ETH')).toBeTruthy()
  })

  it('"Ver no Etherscan" na Ethereum e "Ver no explorador" nas outras redes, em nova aba', () => {
    const { rerender } = render(<OrderReceipt order={order} />)
    const link = screen.getByRole('link', { name: /Ver no Etherscan/ })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.textContent).toContain('(abre em nova aba)')
    rerender(<OrderReceipt order={{ ...order, network: 'polygon' }} />)
    expect(screen.getByRole('link', { name: /Ver no explorador/ })).toBeTruthy()
    expect(screen.getByText(/Transação confirmada na Polygon\./)).toBeTruthy()
  })
})
