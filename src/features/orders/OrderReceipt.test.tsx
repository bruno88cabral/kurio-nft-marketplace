// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Order } from '@/contracts'
import { parseEth } from '@/lib/eth'
import { OrderReceipt } from './OrderReceipt'

afterEach(cleanup)

const item = { nftId: 'nft-002', name: 'Solar Veil', edition: '1/10' as const, quantity: 1, unitPrice: parseEth('0.35') }
const order: Order = {
  id: 'o1',
  status: 'confirmed',
  idempotencyKey: 'k1',
  quoteId: 'q1',
  walletId: 'w1',
  network: 'ethereum',
  items: [item],
  receipt: { items: [item], subtotal: parseEth('0.35'), discount: parseEth('0'), networkFee: parseEth('0.002'), total: parseEth('0.352') },
  txHash: '0xabc',
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
}

describe('OrderReceipt', () => {
  it('mostra a taxa de rede cobrada, sem "Estimada"', () => {
    render(<OrderReceipt order={order} />)
    expect(screen.getByText('Taxa de rede')).toBeTruthy()
    expect(screen.queryByText('Estimada')).toBeNull()
    expect(screen.getByText('0.352 ETH')).toBeTruthy()
  })
})
