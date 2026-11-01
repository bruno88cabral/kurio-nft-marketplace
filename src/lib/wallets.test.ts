import { describe, expect, it } from 'vitest'
import type { Wallet } from '@/contracts'
import { sortWallets } from './wallets'

const wallet = (id: string, role: Wallet['role']): Wallet => ({
  id,
  address: `0x${id.padStart(40, '0')}`,
  network: 'ethereum',
  role,
  label: id,
})

describe('sortWallets', () => {
  it('principal primeiro, o resto na ordem da API, sem mutar a entrada', () => {
    const input = [wallet('a', 'secondary'), wallet('b', 'secondary'), wallet('c', 'primary')]
    expect(sortWallets(input).map((w) => w.id)).toEqual(['c', 'a', 'b'])
    expect(input.map((w) => w.id)).toEqual(['a', 'b', 'c'])
  })

  it('lista vazia', () => {
    expect(sortWallets([])).toEqual([])
  })
})
