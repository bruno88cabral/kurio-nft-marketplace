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

export function mulEth(value: EthAmount, qty: number): EthAmount {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error(`Quantidade inválida: ${qty}`)
  }
  return toEth(new Big(value).times(qty))
}
