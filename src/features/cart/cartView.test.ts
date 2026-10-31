import { describe, expect, it } from 'vitest'
import { couponStatus, issuesByLine } from './cartView'

describe('couponStatus', () => {
  const base = { submitting: false, couponCode: undefined, quote: undefined, quoteError: false } as const

  it('sem código gravado é idle; enviando é applying', () => {
    expect(couponStatus(base)).toBe('idle')
    expect(couponStatus({ ...base, submitting: true })).toBe('applying')
  })

  it('usa o status da cotação quando ela traz o código gravado (sem diferenciar caixa)', () => {
    const quote = { coupon: { code: 'KURIO10', status: 'applied' as const } }
    expect(couponStatus({ ...base, couponCode: 'kurio10', quote })).toBe('applied')
    expect(couponStatus({ ...base, couponCode: 'X', quote: { coupon: { code: 'X', status: 'invalid' } } })).toBe('invalid')
  })

  it('código novo ainda sem cotação correspondente: applying; com a cotação em erro, idle', () => {
    const old = { coupon: { code: 'KURIO10', status: 'applied' as const } }
    expect(couponStatus({ ...base, couponCode: 'OUTRO', quote: old })).toBe('applying')
    expect(couponStatus({ ...base, couponCode: 'OUTRO', quote: undefined, quoteError: true })).toBe('idle')
  })
})

describe('issuesByLine', () => {
  it('indexa por nftId:edition e "unavailable" vence "price_changed"', () => {
    const map = issuesByLine([
      { nftId: 'a', edition: '1/10', kind: 'price_changed' },
      { nftId: 'a', edition: '1/10', kind: 'unavailable' },
      { nftId: 'b', edition: 'open', kind: 'price_changed' },
    ])
    expect(map.get('a:1/10')).toBe('unavailable')
    expect(map.get('b:open')).toBe('price_changed')
    expect(issuesByLine(undefined).size).toBe(0)
  })
})
