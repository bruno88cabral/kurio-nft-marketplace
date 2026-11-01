// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { EmptyState, ErrorState } from './StateMessage'

describe('EmptyState', () => {
  it('mínimo: título e ícone padrão', () => {
    const { container } = renderWithProviders(<EmptyState title="Vazio" />)
    expect(screen.getByText('Vazio')).toBeTruthy()
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('com descrição, ícone e ação', () => {
    renderWithProviders(
      <EmptyState title="Vazio" description="Nada aqui" icon={<i data-testid="ic" />} action={<button>Agir</button>} />,
    )
    expect(screen.getByText('Nada aqui')).toBeTruthy()
    expect(screen.getByTestId('ic')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Agir' })).toBeTruthy()
  })
})

describe('ErrorState', () => {
  it('padrão: título genérico, sem retry', () => {
    renderWithProviders(<ErrorState />)
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar.')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('com retry: o clique chama onRetry', () => {
    const onRetry = vi.fn()
    renderWithProviders(<ErrorState title="Falhou" description="Tente de novo" onRetry={onRetry} />)
    expect(screen.getByText('Tente de novo')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('retrying: aria-disabled e o clique é ignorado', () => {
    const onRetry = vi.fn()
    renderWithProviders(<ErrorState onRetry={onRetry} retrying />)
    const button = screen.getByRole('button', { name: 'Tentar novamente' })
    expect(button.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(button)
    expect(onRetry).not.toHaveBeenCalled()
  })
})
