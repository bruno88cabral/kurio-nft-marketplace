import { describe, expect, it } from 'vitest'
import { parseEth } from './eth'
import { priceRangePatch, sliderBounds, sliderValue, stepsToEth } from './priceRange'

const facets = { min: parseEth('0.03'), max: parseEth('5') }

describe('priceRange', () => {
  it('limites do slider em passos de 0.01 ETH, arredondando para fora', () => {
    expect(sliderBounds({ min: parseEth('0.035'), max: parseEth('4.991') })).toEqual([3, 500])
    expect(sliderBounds(facets)).toEqual([3, 500])
  })

  it('converte passos de volta para ETH sem float', () => {
    expect(stepsToEth(3)).toBe('0.03')
    expect(stepsToEth(500)).toBe('5')
    expect(stepsToEth(110)).toBe('1.1')
  })

  it('valor inicial vem da URL, limitado aos limites; sem filtro usa os limites', () => {
    expect(sliderValue({}, facets)).toEqual([3, 500])
    expect(sliderValue({ priceMin: parseEth('1.2'), priceMax: parseEth('9') }, facets)).toEqual([120, 500])
  })

  it('Aplicar só grava o lado que saiu do limite; faixa inteira remove o filtro', () => {
    expect(priceRangePatch([3, 500], facets)).toEqual({ priceMin: undefined, priceMax: undefined })
    expect(priceRangePatch([3, 250], facets)).toEqual({ priceMin: undefined, priceMax: '2.5' })
    expect(priceRangePatch([10, 500], facets)).toEqual({ priceMin: '0.1', priceMax: undefined })
  })
})
