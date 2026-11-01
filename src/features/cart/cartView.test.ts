import { describe, expect, it } from 'vitest'
import { parseEth } from '@/lib/eth'
import {
  canCheckout,
  CHECKOUT_BLOCK_MESSAGE,
  checkoutBlock,
  couponStatus,
  guestPartialAddMessage,
  guestStockLimitMessage,
  issuesByLine,
  lineChangeAnnouncement,
  QUOTE_ISSUES_MESSAGE,
} from './cartView'

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

describe('canCheckout', () => {
  const ok = { quote: {}, recalculating: false, quoteError: false }

  it('libera só com cotação atual, sem erro e sem issues', () => {
    expect(canCheckout(ok)).toBe(true)
    expect(canCheckout({ ...ok, quote: { issues: [] } })).toBe(true)
  })

  it('bloqueia sem cotação', () => {
    expect(canCheckout({ ...ok, quote: undefined })).toBe(false)
  })

  it('bloqueia com issues', () => {
    expect(canCheckout({ ...ok, quote: { issues: [{ nftId: 'a', edition: 'open', kind: 'unavailable' }] } })).toBe(false)
  })

  it('bloqueia durante a recotação (cotação anterior)', () => {
    expect(canCheckout({ ...ok, recalculating: true })).toBe(false)
  })

  it('bloqueia quando a recotação falhou, mesmo com a cotação antiga em cache', () => {
    expect(canCheckout({ ...ok, quoteError: true })).toBe(false)
  })
})

describe('checkoutBlock (o motivo do CTA bloqueado)', () => {
  const ok = { quote: {}, recalculating: false, quoteError: false }
  const issues = { issues: [{ nftId: 'a', edition: 'open' as const, kind: 'unavailable' as const }] }

  it('nenhum motivo com a cotação atual', () => {
    expect(checkoutBlock(ok)).toBeUndefined()
  })

  it('erro vale mais que tudo; depois sem cotação, recotando e issues', () => {
    expect(checkoutBlock({ ...ok, quote: undefined, quoteError: true })).toBe('error')
    expect(checkoutBlock({ ...ok, quoteError: true, recalculating: true })).toBe('error')
    expect(checkoutBlock({ ...ok, quote: undefined })).toBe('loading')
    expect(checkoutBlock({ ...ok, quote: issues, recalculating: true })).toBe('recalculating')
    expect(checkoutBlock({ ...ok, quote: issues })).toBe('issues')
  })

  it('cada motivo tem texto; o de issues é o mesmo aviso do resumo', () => {
    for (const message of Object.values(CHECKOUT_BLOCK_MESSAGE)) expect(message.length).toBeGreaterThan(0)
    expect(CHECKOUT_BLOCK_MESSAGE.issues).toBe(QUOTE_ISSUES_MESSAGE)
  })
})

describe('guestStockLimitMessage', () => {
  it('singular, plural e esgotado', () => {
    expect(guestStockLimitMessage(1)).toBe('Só resta 1 unidade desta edição, e ela já está no seu carrinho.')
    expect(guestStockLimitMessage(7)).toBe('Só restam 7 unidades desta edição, e todas já estão no seu carrinho.')
    expect(guestStockLimitMessage(0)).toBe('Esta edição está esgotada.')
  })
})

describe('guestPartialAddMessage', () => {
  it('diz a quantidade que ficou no carrinho, no singular e no plural', () => {
    expect(guestPartialAddMessage(1)).toBe('Só resta 1 unidade desta edição: seu carrinho ficou com 1.')
    expect(guestPartialAddMessage(3)).toBe('Só restam 3 unidades desta edição: seu carrinho ficou com 3.')
  })
})

describe('lineChangeAnnouncement', () => {
  const name = 'Emerald Ape #042'
  const line = (unitPrice: string | undefined, issue?: 'price_changed' | 'unavailable') => ({
    unitPrice: unitPrice === undefined ? undefined : parseEth(unitPrice),
    issue,
  })

  it('preço exibido mudou (tempo real): anuncia', () => {
    expect(lineChangeAnnouncement(name, line('1.19'), line('1.25'))).toBe('O preço de Emerald Ape #042 mudou.')
  })

  it('a cotação passou a marcar a linha: "Preço alterado" ou "Indisponível"', () => {
    expect(lineChangeAnnouncement(name, line('1.19'), line('1.19', 'price_changed'))).toBe('O preço de Emerald Ape #042 mudou.')
    expect(lineChangeAnnouncement(name, line('1.19'), line('1.19', 'unavailable'))).toBe('Emerald Ape #042 ficou indisponível.')
  })

  it('não anuncia o primeiro preço, o mesmo valor de novo nem a volta ao normal', () => {
    expect(lineChangeAnnouncement(name, line(undefined), line('1.19'))).toBeUndefined()
    expect(lineChangeAnnouncement(name, line('1.190', 'price_changed'), line('1.19', 'price_changed'))).toBeUndefined()
    expect(lineChangeAnnouncement(name, line('1.19', 'unavailable'), line('1.19'))).toBeUndefined()
  })
})
