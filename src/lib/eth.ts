import Big from 'big.js'
import type { EthAmount } from '@/contracts/money'

const DECIMAL = /^\d+(\.\d+)?$/

export function parseEth(value: string): EthAmount {
  if (!DECIMAL.test(value)) {
    throw new Error(`Valor em ETH inválido: "${value}"`)
  }
  return value as EthAmount
}

// Big#toFixed() nunca usa notação científica
function toEth(big: Big): EthAmount {
  return big.toFixed() as EthAmount
}

export interface FormatEthOptions {
  /** Casas decimais máximas (padrão 4). */
  maxDecimals?: number
  /** Casas decimais mínimas (padrão 0). */
  minDecimals?: number
}

export function formatEth(value: EthAmount, opts: FormatEthOptions = {}): string {
  const { maxDecimals = 4, minDecimals = 0 } = opts
  const fixed = new Big(value).round(maxDecimals, Big.roundHalfUp).toFixed()
  const [int = '0', frac = ''] = fixed.split('.')
  const padded = frac.padEnd(minDecimals, '0')
  return padded ? `${int}.${padded}` : int
}

export function addEth(...values: EthAmount[]): EthAmount {
  return toEth(values.reduce((acc, v) => acc.plus(v), new Big(0)))
}

/** `a - b`; resultado negativo é erro (ETH da API nunca é negativo). */
export function subEth(a: EthAmount, b: EthAmount): EthAmount {
  const result = new Big(a).minus(b)
  if (result.lt(0)) {
    throw new Error(`Subtração resultaria em valor negativo: ${a} - ${b}`)
  }
  return toEth(result)
}

/** `percent`% de `value` (10 → 10%), arredondado a 18 casas (precisão do wei), half-up. */
export function percentEth(value: EthAmount, percent: number): EthAmount {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new Error(`Percentual inválido: ${percent}`)
  }
  return toEth(new Big(value).times(percent).div(100).round(18, Big.roundHalfUp))
}

export function mulEth(value: EthAmount, qty: number): EthAmount {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error(`Quantidade inválida: ${qty}`)
  }
  return toEth(new Big(value).times(qty))
}
