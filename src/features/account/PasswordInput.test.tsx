// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { PasswordInput } from './PasswordInput'

describe('PasswordInput', () => {
  it('começa oculta e o botão alterna entre password e text', () => {
    renderWithProviders(<PasswordInput id="senha" aria-label="Senha" className="extra" />)
    const input = screen.getByLabelText('Senha')
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' })
    expect(input.getAttribute('type')).toBe('password')
    expect(input.className).toContain('extra')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(toggle.getAttribute('aria-controls')).toBe('senha')

    fireEvent.click(toggle)
    expect(input.getAttribute('type')).toBe('text')
    expect(screen.getByRole('button', { name: 'Mostrar senha' }).getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(toggle)
    expect(input.getAttribute('type')).toBe('password')
  })

  it('desabilitado desabilita também o botão', () => {
    renderWithProviders(<PasswordInput disabled aria-label="Senha" />)
    expect((screen.getByRole<HTMLButtonElement>('button', { name: 'Mostrar senha' })).disabled).toBe(true)
  })
})
