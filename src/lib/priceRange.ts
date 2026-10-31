import Big from 'big.js'
import type { EthAmount, NftFacets } from '@/contracts'
import type { CatalogSearch } from './catalogSearch'

/**
 * Slider da faixa de preço do catálogo. O Radix trabalha com `number`; para não fazer conta de
 * ETH em float, o slider anda em passos inteiros de 0.01 ETH e a conversão usa big.js.
 */
const STEPS_PER_ETH = 100

type Range = NftFacets['price']
export type SliderRange = [number, number]

function toSteps(value: EthAmount, rm: Big.RoundingMode): number {
  return new Big(value).times(STEPS_PER_ETH).round(0, rm).toNumber()
}

export function stepsToEth(steps: number): EthAmount {
  return new Big(steps).div(STEPS_PER_ETH).toFixed() as EthAmount
}

/** Limites do slider a partir das facetas, arredondando para fora (o mínimo e o máximo cabem). */
export function sliderBounds(range: Range): SliderRange {
  return [toSteps(range.min, Big.roundDown), toSteps(range.max, Big.roundUp)]
}

const clamp = (n: number, [lo, hi]: SliderRange) => Math.min(hi, Math.max(lo, n))

/** Posição inicial dos polos: a faixa da URL (limitada aos limites) ou os próprios limites. */
export function sliderValue(search: Pick<CatalogSearch, 'priceMin' | 'priceMax'>, range: Range): SliderRange {
  const bounds = sliderBounds(range)
  return [
    search.priceMin === undefined ? bounds[0] : clamp(toSteps(search.priceMin, Big.roundHalfUp), bounds),
    search.priceMax === undefined ? bounds[1] : clamp(toSteps(search.priceMax, Big.roundHalfUp), bounds),
  ]
}

/** Patch do "Aplicar": um polo no limite não filtra aquele lado (faixa inteira = sem filtro). */
export function priceRangePatch(
  [lo, hi]: SliderRange,
  range: Range,
): Pick<CatalogSearch, 'priceMin' | 'priceMax'> {
  const [min, max] = sliderBounds(range)
  return {
    priceMin: lo > min ? stepsToEth(lo) : undefined,
    priceMax: hi < max ? stepsToEth(hi) : undefined,
  }
}
