// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { EditionChips } from './EditionChips'

const EDITIONS = [
  { kind: 'open', available: 9 },
  { kind: '1/10', available: 5 },
  { kind: '1/1', available: 0 },
] as const

describe('EditionChips', () => {
  it('mostra as edições na ordem do produto, marca a escolhida e sinaliza a esgotada com texto', () => {
    renderWithProviders(<EditionChips editions={EDITIONS} value="1/10" onValueChange={vi.fn()} className="x" />)
    const group = screen.getByRole('radiogroup', { name: 'Edição' })
    const chips = Array.from(group.querySelectorAll('button'))
    expect(chips).toHaveLength(3)
    expect(chips[0].textContent).toContain('Esgotada')
    expect(chips[0].disabled).toBe(true)
    expect(chips[0].getAttribute('data-unavailable')).toBe('true')
    expect(chips[1].getAttribute('aria-pressed') ?? chips[1].getAttribute('data-state')).toBeTruthy()
    expect(chips[1].getAttribute('data-state')).toBe('on')
    expect(chips[2].getAttribute('data-state')).toBe('off')
    expect(chips[1].getAttribute('data-unavailable')).toBeNull()
  })

  it('clicar em outra edição avisa; clicar na já escolhida não desmarca', () => {
    const onValueChange = vi.fn()
    renderWithProviders(<EditionChips editions={EDITIONS} value="1/10" onValueChange={onValueChange} label="Qual?" />)
    const chips = Array.from(screen.getByRole('radiogroup', { name: 'Qual?' }).querySelectorAll('button'))
    fireEvent.click(chips[1])
    expect(onValueChange).not.toHaveBeenCalled()
    fireEvent.click(chips[2])
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('open')
  })

  it('sem valor nenhum selecionado e desabilitado: nada fica marcado e nada responde', () => {
    const onValueChange = vi.fn()
    renderWithProviders(<EditionChips editions={EDITIONS} value={undefined} onValueChange={onValueChange} disabled />)
    const chips = Array.from(screen.getByRole('radiogroup').querySelectorAll('button'))
    expect(chips.every((c) => c.disabled && c.getAttribute('data-state') === 'off')).toBe(true)
    fireEvent.click(chips[2])
    expect(onValueChange).not.toHaveBeenCalled()
  })
})
