import { describe, expect, it } from 'vitest'
import type { Quote } from '@/contracts'
import { parseEth } from '@/lib/eth'
import { changeMessages, diffSnapshots, snapshotOf } from './reviewSnapshot'

const quote = (overrides: Partial<Quote> = {}): Quote => ({
  quoteId: 'q1',
  items: [
    { nftId: 'nft-002', edition: '1/10', quantity: 2, unitPrice: parseEth('0.5') },
    { nftId: 'nft-005', edition: 'open', quantity: 1, unitPrice: parseEth('0.2') },
  ],
  subtotal: parseEth('1.2'),
  discount: parseEth('0'),
  networkFee: parseEth('0.002'),
  total: parseEth('1.202'),
  expiresAt: '2026-10-31T12:05:00.000Z',
  ...overrides,
})

describe('diffSnapshots', () => {
  it('cotação nova com os mesmos valores (outro quoteId, "1.20" = "1.2") não tem diferença', () => {
    const after = quote({ quoteId: 'q2', total: parseEth('1.2020') })
    expect(diffSnapshots(snapshotOf(quote()), snapshotOf(after))).toEqual([])
  })

  it('aponta preço unitário, total, taxa, cupom e issues', () => {
    const after = quote({
      quoteId: 'q2',
      items: [
        { nftId: 'nft-002', edition: '1/10', quantity: 2, unitPrice: parseEth('0.51') },
        { nftId: 'nft-005', edition: 'open', quantity: 1, unitPrice: parseEth('0.2') },
      ],
      total: parseEth('1.222'),
      networkFee: parseEth('0.003'),
      coupon: { code: 'KURIO10', status: 'expired' },
      issues: [{ nftId: 'nft-005', edition: 'open', kind: 'unavailable' }],
    })
    const kinds = diffSnapshots(snapshotOf(quote()), snapshotOf(after)).map((c) => c.kind)
    expect(kinds).toEqual(['unitPrice', 'coupon', 'networkFee', 'total', 'issues'])
  })

  it('linha que entrou, saiu ou mudou de quantidade conta como mudança', () => {
    const before = snapshotOf(quote())
    const after = snapshotOf(
      quote({
        items: [
          { nftId: 'nft-002', edition: '1/10', quantity: 1, unitPrice: parseEth('0.5') },
          { nftId: 'nft-009', edition: '1/1', quantity: 1, unitPrice: parseEth('0.2') },
        ],
      }),
    )
    expect(diffSnapshots(before, after)).toEqual([
      { kind: 'quantity', line: 'nft-002:1/10', before: 2, after: 1 },
      { kind: 'line', line: 'nft-005:open', change: 'removed' },
      { kind: 'line', line: 'nft-009:1/1', change: 'added' },
    ])
  })

  it('changeMessages separa o texto da linha do texto do resumo', () => {
    const { byLine, summary } = changeMessages([
      { kind: 'unitPrice', line: 'nft-002:1/10', before: parseEth('0.5'), after: parseEth('0.51') },
      { kind: 'total', before: parseEth('1.202'), after: parseEth('1.222') },
    ])
    expect(byLine.get('nft-002:1/10')).toMatch(/^Preço alterado de .*0[.,]5.* para .*0[.,]51/)
    expect(summary).toHaveLength(1)
  })
})
