import { describe, expect, it } from 'vitest'
import { editionLabel, isSoldOut, sortEditions } from './editions'
import { clampInt, clampQuantity } from './quantity'
import { networkLabel, shortAddress, walletProviderLabel, walletRoleLabel } from './wallets'

describe('editions', () => {
  it('rotula open como ABERTA e mantém as frações', () => {
    expect(editionLabel('open')).toBe('ABERTA')
    expect(editionLabel('1/50')).toBe('1/50')
  })

  it('ordena na ordem do Figma', () => {
    const sorted = sortEditions([{ kind: 'open' }, { kind: '1/1' }, { kind: '1/50' }, { kind: '1/10' }])
    expect(sorted.map((e) => e.kind)).toEqual(['1/1', '1/10', '1/50', 'open'])
  })

  it('esgotado só quando nenhuma edição tem unidade', () => {
    expect(isSoldOut([{ available: 0 }, { available: 0 }])).toBe(true)
    expect(isSoldOut([{ available: 0 }, { available: 3 }])).toBe(false)
    expect(isSoldOut([])).toBe(true)
  })
})

describe('quantity', () => {
  it('limita ao intervalo e trunca', () => {
    expect(clampInt(0, 1, 5)).toBe(1)
    expect(clampInt(9, 1, 5)).toBe(5)
    expect(clampInt(2.7, 1, 5)).toBe(2)
    expect(clampInt(3, 1, 0)).toBe(1)
  })

  it('interpreta o texto digitado', () => {
    expect(clampQuantity(' 3 ', 1, 10, 1)).toBe(3)
    expect(clampQuantity('99', 1, 10, 1)).toBe(10)
    expect(clampQuantity('0', 1, 10, 4)).toBe(1)
    expect(clampQuantity('', 1, 10, 4)).toBe(4)
    expect(clampQuantity('-2', 1, 10, 4)).toBe(4)
    expect(clampQuantity('2.5', 1, 10, 4)).toBe(4)
    expect(clampQuantity('abc', 1, 10, 40)).toBe(10)
  })
})

describe('wallets', () => {
  it('encurta endereço 0x mantendo o prefixo', () => {
    expect(shortAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234…5678')
    expect(shortAddress('0x12ab')).toBe('0x12ab')
  })

  it('tem rótulos de UI para provedor, rede e papel', () => {
    expect(walletProviderLabel('walletconnect')).toBe('WalletConnect')
    expect(networkLabel('arbitrum')).toBe('Arbitrum')
    expect(walletRoleLabel('secondary')).toBe('Reserva')
  })
})
