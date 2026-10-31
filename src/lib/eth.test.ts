import { describe, expect, it } from 'vitest'
import { addEth, formatEth, mulEth, parseEth, percentEth, subEth } from './eth'

describe('eth', () => {
  it('soma sem erro de ponto flutuante', () => {
    expect(addEth(parseEth('0.1'), parseEth('0.2'))).toBe('0.3')
  })

  it('multiplica por quantidade inteira', () => {
    expect(mulEth(parseEth('0.125'), 3)).toBe('0.375')
  })

  it('subtrai sem erro de ponto flutuante e recusa resultado negativo', () => {
    expect(subEth(parseEth('0.3'), parseEth('0.1'))).toBe('0.2')
    expect(subEth(parseEth('1'), parseEth('1'))).toBe('0')
    expect(() => subEth(parseEth('0.1'), parseEth('0.2'))).toThrow()
  })

  it('calcula percentual em ETH sem Number', () => {
    expect(percentEth(parseEth('1.25'), 10)).toBe('0.125')
    expect(percentEth(parseEth('0.3'), 10)).toBe('0.03')
    expect(percentEth(parseEth('0.1'), 5)).toBe('0.005')
    expect(percentEth(parseEth('2'), 0)).toBe('0')
    expect(() => percentEth(parseEth('1'), -1)).toThrow()
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
