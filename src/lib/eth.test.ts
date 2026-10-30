import { describe, expect, it } from 'vitest'
import { addEth, formatEth, mulEth, parseEth } from './eth'

describe('eth', () => {
  it('soma sem erro de ponto flutuante', () => {
    expect(addEth(parseEth('0.1'), parseEth('0.2'))).toBe('0.3')
  })

  it('multiplica por quantidade inteira', () => {
    expect(mulEth(parseEth('0.125'), 3)).toBe('0.375')
  })

  it('rejeita notação científica e valores inválidos', () => {
    expect(() => parseEth('1e3')).toThrow()
    expect(() => parseEth('-1')).toThrow()
    expect(() => parseEth('')).toThrow()
  })

  it('rejeita quantidade não inteira', () => {
    expect(() => mulEth(parseEth('1'), 1.5)).toThrow()
  })

  it('formata sem notação científica e com casas configuráveis', () => {
    expect(formatEth(parseEth('0.00000001'), { maxDecimals: 8 })).toBe('0.00000001')
    expect(formatEth(parseEth('0.12345'), { maxDecimals: 2 })).toBe('0.12')
    expect(formatEth(parseEth('1.5'), { minDecimals: 3 })).toBe('1.500')
    expect(formatEth(parseEth('2'))).toBe('2')
  })
})
