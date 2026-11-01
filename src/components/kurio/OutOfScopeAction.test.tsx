// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'

type ToastFn = (message: string, options?: { id?: string }) => void
const toast = vi.hoisted(() => ({ info: vi.fn<ToastFn>(), success: vi.fn<ToastFn>(), error: vi.fn<ToastFn>() }))
vi.mock('sonner', () => ({ toast }))

// O foco abre o tooltip (Radix), que mede o conteúdo com ResizeObserver: o jsdom não tem
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const { OutOfScopeAction, OUT_OF_SCOPE_TOAST_ID } = await import('./OutOfScopeAction')

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderAction() {
  render(
    <TooltipProvider>
      <OutOfScopeAction label="Favoritos">ícone</OutOfScopeAction>
    </TooltipProvider>,
  )
  return screen.getByRole('button', { name: 'Favoritos (em breve)' })
}

describe('OutOfScopeAction: retorno "Em breve" (R-28)', () => {
  it('continua aria-disabled e focável', () => {
    const button = renderAction()
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.hasAttribute('disabled')).toBe(false)
    button.focus()
    expect(document.activeElement).toBe(button)
  })

  it('o clique (ou toque) mostra o toast informativo "Em breve", nunca o de sucesso', () => {
    const button = renderAction()
    fireEvent.click(button)
    expect(toast.info).toHaveBeenCalledTimes(1)
    expect(toast.info).toHaveBeenCalledWith('Em breve', { id: OUT_OF_SCOPE_TOAST_ID })
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('o clique não segue adiante (preventDefault)', () => {
    const button = renderAction()
    const notCanceled = fireEvent.click(button)
    expect(notCanceled).toBe(false)
  })

  it('foco por teclado + Enter gera um único toast (o Enter só vira o click nativo)', () => {
    const button = renderAction()
    fireEvent.focus(button)
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.keyUp(button, { key: 'Enter' })
    expect(toast.info).not.toHaveBeenCalled()
    // O navegador converte o Enter em um `click` no botão: é ele que avisa, uma vez só.
    fireEvent.click(button)
    expect(toast.info).toHaveBeenCalledTimes(1)
  })

  it('cliques seguidos reaproveitam o mesmo toast (id fixo), sem empilhar', () => {
    const button = renderAction()
    fireEvent.click(button)
    fireEvent.click(button)
    expect(toast.info.mock.calls.every(([, opts]) => opts?.id === OUT_OF_SCOPE_TOAST_ID)).toBe(true)
  })
})
