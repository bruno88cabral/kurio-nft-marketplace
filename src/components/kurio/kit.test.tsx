// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
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

  it('depois de remover, o foco vai para o campo do cupom (applied e invalid), e fora disso o foco não é mexido', () => {
    const Harness = ({ initial }: { initial: 'applied' | 'invalid' }) => {
      const [status, setStatus] = useState<'applied' | 'invalid' | 'idle'>(initial)
      return <CouponInput status={status} appliedCode="KURIO10" onApply={() => undefined} onRemove={() => setStatus('idle')} />
    }
    for (const initial of ['applied', 'invalid'] as const) {
      const { unmount } = render(<Harness initial={initial} />)
      fireEvent.click(screen.getByRole('button', { name: /Remover\s*cupom KURIO10/ }))
      expect(document.activeElement).toBe(screen.getByLabelText('Cupom de desconto'))
      unmount()
    }
    // Sem remoção (campo idle montado), o foco continua onde estava
    render(<CouponInput status="idle" onApply={() => undefined} onRemove={() => undefined} />)
    expect(document.activeElement).toBe(document.body)
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

  it('cotação: a taxa de rede diz "Taxa estimada"', () => {
    render(<PriceSummary quote={values} />)
    expect(screen.getByText('Taxa estimada')).toBeTruthy()
  })

  it('recibo: a taxa já foi cobrada, sem "Taxa estimada"', () => {
    render(<PriceSummary quote={values} mode="receipt" />)
    expect(screen.queryByText('Taxa estimada')).toBeNull()
    expect(screen.getByText('Taxa de rede')).toBeTruthy()
    expect(screen.getByText('0.002 ETH')).toBeTruthy()
  })
})

describe('PriceSummary: desconto', () => {
  const values = { subtotal: parseEth('0.35'), discount: parseEth('0'), networkFee: parseEth('0.002'), total: parseEth('0.352') }

  it('sem cupom, o desconto só aparece com `alwaysShowDiscount` (Carrinho), como "(-) 0 ETH"', () => {
    const { rerender } = render(<PriceSummary quote={values} />)
    expect(screen.queryByText('Desconto')).toBeNull()
    rerender(<PriceSummary quote={values} alwaysShowDiscount />)
    expect(screen.getByText('Desconto')).toBeTruthy()
    expect(screen.getByText('(-) 0 ETH')).toBeTruthy()
  })

  it('com cupom aplicado, o rótulo leva o código', () => {
    render(
      <PriceSummary
        quote={{ ...values, discount: parseEth('0.035'), total: parseEth('0.317'), coupon: { code: 'KURIO10', status: 'applied' } }}
      />,
    )
    expect(screen.getByText('Desconto (KURIO10)')).toBeTruthy()
    expect(screen.getByText('(-) 0.035 ETH')).toBeTruthy()
  })
})

describe('CouponInput: aparência "attached" (Carrinho)', () => {
  it('rótulo "Código promocional" e o placeholder do Figma', () => {
    render(<CouponInput appearance="attached" status="idle" onApply={() => undefined} />)
    expect(screen.getByLabelText('Código promocional').getAttribute('placeholder')).toBe('Digite o código promocional...')
  })
})
