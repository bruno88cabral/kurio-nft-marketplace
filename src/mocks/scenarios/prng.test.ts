import { describe, expect, it } from 'vitest'
import { mulberry32 } from './prng'

describe('mulberry32', () => {
  it('mesmo seed gera a mesma sequência', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('seeds diferentes divergem e os valores ficam em [0, 1)', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    expect(a()).not.toBe(b())
    const values = Array.from({ length: 1_000 }, mulberry32(7))
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true)
  })
})
