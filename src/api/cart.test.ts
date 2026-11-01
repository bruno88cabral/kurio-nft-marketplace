import { afterEach, describe, expect, it, vi } from 'vitest'
import { PRIVATE_QUERY_ROOTS } from '@/auth/sessionLifecycle'
import type { Cart, Quote } from '@/contracts'
import { addCartItem, cartFingerprint, cartKeys, cartQuery, mergeCart, removeCartItem, updateCartItem } from './cart'
import { apiClient } from './client'
import { createOrder, orderKeys, orderQuery } from './orders'
import { quoteQuery, quoteRefetchDelay, QUOTE_MIN_REFETCH_MS, QUOTE_REFRESH_MARGIN_MS, QUOTE_STALE_TIME_MS } from './quotes'
import { connectWallet } from './wallets'

afterEach(() => vi.restoreAllMocks())

const cart = (items: Cart['items'], couponCode?: string): Cart => ({ items, ...(couponCode ? { couponCode } : {}) })
const l = (nftId: string, edition: Cart['items'][number]['edition'], quantity: number) => ({ nftId, edition, quantity })

describe('chaves', () => {
  it('isoladas por conta e sob raízes privadas', () => {
    expect(cartKeys.detail('acc-1')).toEqual(['cart', 'acc-1'])
    expect(cartKeys.quote('acc-1', 'f')).toEqual(['cart', 'acc-1', 'quote', 'f'])
    expect(orderKeys.detail('acc-1', 'o-1')).toEqual(['orders', 'acc-1', 'o-1'])
    expect(cartQuery('acc-1').queryKey).toEqual(['cart', 'acc-1'])
    expect(orderQuery('acc-1', 'o-1').queryKey).toEqual(['orders', 'acc-1', 'o-1'])
    expect(PRIVATE_QUERY_ROOTS).toContain(cartKeys.all[0])
    expect(PRIVATE_QUERY_ROOTS).toContain(orderKeys.all[0])
  })
})

describe('cartFingerprint', () => {
  it('é estável com a ordem das linhas trocada', () => {
    const a = cart([l('n1', '1/10', 2), l('n2', 'open', 1)])
    const b = cart([l('n2', 'open', 1), l('n1', '1/10', 2)])
    expect(cartFingerprint(a)).toBe(cartFingerprint(b))
  })

  it('muda com quantidade, edição, linha ou cupom', () => {
    const base = cartFingerprint(cart([l('n1', '1/10', 2)]))
    expect(cartFingerprint(cart([l('n1', '1/10', 3)]))).not.toBe(base)
    expect(cartFingerprint(cart([l('n1', 'open', 2)]))).not.toBe(base)
    expect(cartFingerprint(cart([l('n1', '1/10', 2), l('n2', 'open', 1)]))).not.toBe(base)
    expect(cartFingerprint(cart([l('n1', '1/10', 2)], 'KURIO10'))).not.toBe(base)
  })

  it('sem ambiguidade: um id com caracteres de separador não colide com outro carrinho', () => {
    // Com texto e separadores (`id:edição x qtd`, `|`, `#`) estes pares davam a mesma chave
    // (`a:openx1|b:1/10x2` para os dois carrinhos abaixo)
    expect(cartFingerprint(cart([l('a:openx1|b', '1/10', 2)]))).not.toBe(
      cartFingerprint(cart([l('a', 'open', 1), l('b', '1/10', 2)])),
    )
  })
})

describe('quoteQuery', () => {
  const full = cart([l('n1', '1/10', 2)])

  it('a chave da cotação muda com a quantidade', () => {
    const a = quoteQuery('acc-1', full).queryKey
    const b = quoteQuery('acc-1', cart([l('n1', '1/10', 3)])).queryKey
    expect(a).not.toEqual(b)
    expect(a.slice(0, 3)).toEqual(['cart', 'acc-1', 'quote'])
  })

  it('só roda com itens', () => {
    expect(quoteQuery('acc-1', full).enabled).toBe(true)
    expect(quoteQuery('acc-1', cart([])).enabled).toBe(false)
  })

  it('fresca por menos que a validade de 5 min', () => {
    expect(QUOTE_STALE_TIME_MS).toBeLessThan(5 * 60_000)
  })

  it('recota antes de vencer, com piso, e para sem cotação', () => {
    const now = Date.parse('2026-10-31T12:00:00.000Z')
    expect(quoteRefetchDelay('2026-10-31T12:05:00.000Z', now)).toBe(5 * 60_000 - QUOTE_REFRESH_MARGIN_MS)
    expect(quoteRefetchDelay('2026-10-31T12:00:30.000Z', now)).toBe(QUOTE_MIN_REFETCH_MS)
    expect(quoteRefetchDelay('2026-10-31T11:00:00.000Z', now)).toBe(QUOTE_MIN_REFETCH_MS)
    expect(quoteRefetchDelay('lixo', now)).toBe(false)

    const interval = quoteQuery('acc-1', full).refetchInterval as (q: { state: { data?: Quote } }) => number | false
    expect(interval({ state: {} })).toBe(false)
    const quote = { expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() } as Quote
    const delay = interval({ state: { data: quote } })
    expect(delay).toBeGreaterThan(3 * 60_000)
    expect(delay).toBeLessThanOrEqual(5 * 60_000 - QUOTE_REFRESH_MARGIN_MS)
  })
})

describe('requests', () => {
  function spyAll() {
    const reply = { data: { items: [] } }
    return {
      get: vi.spyOn(apiClient, 'get').mockResolvedValue(reply),
      post: vi.spyOn(apiClient, 'post').mockResolvedValue(reply),
      patch: vi.spyOn(apiClient, 'patch').mockResolvedValue(reply),
      delete: vi.spyOn(apiClient, 'delete').mockResolvedValue(reply),
    }
  }

  it('a edição com barra vai codificada no path', async () => {
    const spy = spyAll()
    await updateCartItem('nft-001', '1/10', { quantity: 2 })
    await removeCartItem('nft-001', '1/10')
    expect(spy.patch).toHaveBeenCalledWith('/cart/items/nft-001/1%2F10', { quantity: 2 })
    expect(spy.delete).toHaveBeenCalledWith('/cart/items/nft-001/1%2F10')
  })

  it('add e merge mandam o corpo; devolvem o Cart', async () => {
    const spy = spyAll()
    await expect(addCartItem(l('n1', 'open', 1))).resolves.toEqual({ items: [] })
    await mergeCart({ items: [l('n1', 'open', 1)] })
    expect(spy.post).toHaveBeenCalledWith('/cart/items', l('n1', 'open', 1))
    expect(spy.post).toHaveBeenCalledWith('/cart/merge', { items: [l('n1', 'open', 1)] })
  })

  it('createOrder leva o Idempotency-Key no header', async () => {
    const spy = spyAll()
    await createOrder({ quoteId: 'q1', walletId: 'w1' }, 'key-123')
    expect(spy.post).toHaveBeenCalledWith('/orders', { quoteId: 'q1', walletId: 'w1' }, { headers: { 'Idempotency-Key': 'key-123' } })
  })

  it('connectWallet chama POST /wallets/:id/connect', async () => {
    const spy = spyAll()
    await connectWallet('w1')
    expect(spy.post).toHaveBeenCalledWith('/wallets/w1/connect')
  })
})
