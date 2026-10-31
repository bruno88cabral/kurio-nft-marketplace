// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseEth } from '@/lib/eth'
import { CouponInput } from './CouponInput'
import { PriceSummary } from './PriceSummary'

afterEach(cleanup)

describe('CouponInput: "Remover"', () => {
  // O jsdom junta o texto `sr-only` ao "Remover" sem o espaço; no browser o nome é "Remover cupom <código>"
  it.each(['invalid', 'expired'] as const)('no estado %s mostra "Remover" com o código no nome e chama onRemove', (status) => {
    const onRemove = vi.fn()
    render(<CouponInput status={status} appliedCode="QUALQUER" onApply={() => undefined} onRemove={onRemove} />)
    expect(screen.getByRole('alert').textContent).toMatch(status === 'invalid' ? 'Cupom inválido.' : 'Cupom expirado.')
    fireEvent.click(screen.getByRole('button', { name: /Remover\s*cupom QUALQUER/ }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('no estado applied continua com "Remover"', () => {
    render(<CouponInput status="applied" appliedCode="KURIO10" onApply={() => undefined} onRemove={() => undefined} />)
    expect(screen.getByRole('button', { name: /Remover\s*cupom KURIO10/ })).toBeTruthy()
  })

  it('sem onRemove, ou em idle/applying, não há "Remover"', () => {
    const { rerender } = render(<CouponInput status="invalid" onApply={() => undefined} />)
    expect(screen.queryByRole('button', { name: /Remover/ })).toBeNull()
    rerender(<CouponInput status="idle" onApply={() => undefined} onRemove={() => undefined} />)
    expect(screen.queryByRole('button', { name: /Remover/ })).toBeNull()
    rerender(<CouponInput status="applying" onApply={() => undefined} onRemove={() => undefined} />)
    expect(screen.queryByRole('button', { name: /Remover/ })).toBeNull()
  })
})

describe('PriceSummary: modo recibo', () => {
  const values = { subtotal: parseEth('0.35'), discount: parseEth('0'), networkFee: parseEth('0.002'), total: parseEth('0.352') }

  it('cotação: a taxa de rede diz "Estimada"', () => {
    render(<PriceSummary quote={values} />)
    expect(screen.getByText('Estimada')).toBeTruthy()
  })

  it('recibo: a taxa já foi cobrada, sem "Estimada"', () => {
    render(<PriceSummary quote={values} mode="receipt" />)
    expect(screen.queryByText('Estimada')).toBeNull()
    expect(screen.getByText('Taxa de rede')).toBeTruthy()
    expect(screen.getByText('0.002 ETH')).toBeTruthy()
  })
})
