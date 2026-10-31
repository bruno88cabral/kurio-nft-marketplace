// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { anonymousCart } from './anonymousCart'
import { CartBadge } from './CartBadge'
import { cartLinkLabel } from './cartView'
import { useCartCount } from './useCartCount'

function CartLink() {
  const count = useCartCount()
  return (
    <a href="/cart" aria-label={cartLinkLabel(count)}>
      <CartBadge count={count} />
    </a>
  )
}

const renderLink = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CartLink />
    </QueryClientProvider>,
  )

beforeEach(() => {
  localStorage.clear()
  anonymousCart.clear()
})
afterEach(cleanup)

describe('badge do carrinho', () => {
  it('soma as quantidades das linhas (visitante) e o número fica aria-hidden', () => {
    anonymousCart.add({ nftId: 'a', edition: '1/10', quantity: 2 }, 10)
    anonymousCart.add({ nftId: 'b', edition: 'open', quantity: 3 }, 10)
    const { container } = renderLink()
    expect(screen.getByRole('link', { name: 'Carrinho, 5 itens' })).toBeTruthy()
    const badge = container.querySelector('[data-slot=cart-badge]')
    expect(badge?.textContent).toBe('5')
    expect(badge?.getAttribute('aria-hidden')).toBe('true')
  })

  it('some com o carrinho vazio e o nome volta a "Carrinho"', () => {
    const { container } = renderLink()
    expect(screen.getByRole('link', { name: 'Carrinho' })).toBeTruthy()
    expect(container.querySelector('[data-slot=cart-badge]')).toBeNull()
  })

  it('singular com uma unidade; 99+ no selo', () => {
    expect(cartLinkLabel(1)).toBe('Carrinho, 1 item')
    const { container } = render(<CartBadge count={120} />)
    expect(container.textContent).toBe('99+')
  })
})
