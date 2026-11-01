// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { QuantityStepper } from './QuantityStepper'

const minus = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Diminuir quantidade' })
const plus = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Aumentar quantidade' })
const field = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Quantidade' })

describe('QuantityStepper', () => {
  it('os botões somam e subtraem um', () => {
    const onChange = vi.fn()
    renderWithProviders(<QuantityStepper value={3} onChange={onChange} max={5} />)
    fireEvent.click(plus())
    expect(onChange).toHaveBeenLastCalledWith(4)
    fireEvent.click(minus())
    expect(onChange).toHaveBeenLastCalledWith(2)
  })

  it('no mínimo o "−" fica aria-disabled e não age; no máximo o "+" também e aparece "Máximo: N"', () => {
    const onChange = vi.fn()
    const { rerender } = renderWithProviders(<QuantityStepper value={1} onChange={onChange} max={4} />)
    expect(minus().getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(minus())
    expect(screen.queryByText(/^Máximo/)).toBeNull()
    expect(field().getAttribute('aria-describedby')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    rerender(<QuantityStepper value={4} onChange={onChange} max={4} />)
    expect(plus().getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(plus())
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Máximo: 4')).toBeTruthy()
    expect(field().getAttribute('aria-describedby')).toBe(screen.getByText('Máximo: 4').id)
  })

  it('digitar é rascunho: vale ao sair do campo, limitado a [min, max]', () => {
    const onChange = vi.fn()
    renderWithProviders(<QuantityStepper value={2} onChange={onChange} max={5} />)
    fireEvent.change(field(), { target: { value: '99' } })
    expect(field().value).toBe('99')
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.blur(field())
    expect(onChange).toHaveBeenCalledExactlyOnceWith(5)
    expect(field().value).toBe('2') // controlado: volta ao value até o pai atualizar
  })

  it('sair do campo sem digitar não faz nada; texto inválido volta ao valor atual', () => {
    const onChange = vi.fn()
    renderWithProviders(<QuantityStepper value={2} onChange={onChange} max={5} />)
    fireEvent.blur(field())
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(field(), { target: { value: 'abc' } })
    fireEvent.blur(field())
    expect(onChange).not.toHaveBeenCalled()
    expect(field().value).toBe('2')
  })

  it('Enter confirma o rascunho; Enter sem rascunho é ignorado', () => {
    const onChange = vi.fn()
    renderWithProviders(<QuantityStepper value={2} onChange={onChange} max={5} />)
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(field(), { target: { value: '4' } })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledExactlyOnceWith(4)
  })

  it('↑ e ↓ incrementam e decrementam (limitados) sem mexer no cursor', () => {
    const onChange = vi.fn()
    renderWithProviders(<QuantityStepper value={3} onChange={onChange} max={4} />)
    expect(fireEvent.keyDown(field(), { key: 'ArrowUp' })).toBe(false)
    expect(onChange).toHaveBeenLastCalledWith(4)
    expect(fireEvent.keyDown(field(), { key: 'ArrowDown' })).toBe(false)
    expect(onChange).toHaveBeenLastCalledWith(2)
    fireEvent.keyDown(field(), { key: 'a' })
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('↑ acima do máximo e ↓ abaixo do mínimo não chamam onChange', () => {
    const onChange = vi.fn()
    renderWithProviders(<QuantityStepper value={4} onChange={onChange} max={4} />)
    fireEvent.keyDown(field(), { key: 'ArrowUp' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('rótulo visível "Qtd.", nome acessível e tamanho sm; disabled desliga tudo e esconde o máximo', () => {
    renderWithProviders(<QuantityStepper value={4} onChange={vi.fn()} max={4} disabled showLabel size="sm" label="Qtde" className="x" />)
    expect(screen.getByText('Qtd.')).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'Qtde' })).toBeTruthy()
    expect(minus().disabled && plus().disabled).toBe(true)
    expect(screen.queryByText(/^Máximo/)).toBeNull()
  })
})
