// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { FavoriteButton } from './FavoriteButton'

describe('FavoriteButton', () => {
  it('overlay (padrão): só o coração, nome "Favoritar <nome>" e o estado no aria-pressed', () => {
    const onToggle = vi.fn()
    renderWithProviders(<FavoriteButton favorited={false} onToggle={onToggle} nftName="Obra 1" />)
    const button = screen.getByRole('button', { name: 'Favoritar Obra 1' })
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.className).toContain('size-7')
    expect(button.className).toContain('text-foreground')
    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('overlay favoritado: coração preenchido e laranja', () => {
    renderWithProviders(<FavoriteButton favorited onToggle={() => {}} nftName="Obra 1" />)
    const button = screen.getByRole('button', { name: 'Favoritar Obra 1' })
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.className).toContain('text-text-accent')
    expect(button.querySelector('svg')?.getAttribute('class')).toContain('fill-current')
  })

  it('round: botão redondo de 44 px, só o coração', () => {
    renderWithProviders(<FavoriteButton favorited={false} onToggle={() => {}} nftName="Obra 1" variant="round" />)
    const button = screen.getByRole('button', { name: 'Favoritar Obra 1' })
    expect(button.className).toContain('size-11')
    expect(button.querySelector('svg')?.getAttribute('class')).toContain('size-5')
  })

  it('default: texto "Favoritar" visível, o nome do NFT só para o leitor de tela, e desabilitável', () => {
    renderWithProviders(<FavoriteButton favorited={false} onToggle={() => {}} nftName="Obra 1" variant="default" disabled />)
    const button = screen.getByRole<HTMLButtonElement>('button', { name: /^Favoritar\s*Obra 1$/ })
    expect(button.hasAttribute('aria-label')).toBe(false)
    expect(button.textContent).toBe('Favoritar Obra 1')
    expect(button.disabled).toBe(true)
  })
})
