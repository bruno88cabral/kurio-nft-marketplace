// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { parseEth } from '@/lib/eth'
import { renderWithProviders } from '@/test/render'
import { PriceTag } from './PriceTag'

const eth = parseEth

describe('PriceTag', () => {
  it('mostra o preço formatado, sem anterior nem live', () => {
    const { container } = renderWithProviders(<PriceTag price={eth('0.35')} />)
    expect(container.textContent).toContain('0.35 ETH')
    const tag = container.querySelector('[data-slot="price-tag"]')
    expect(tag?.getAttribute('aria-live')).toBeNull()
    expect(tag?.hasAttribute('data-changed')).toBe(false)
    expect(screen.queryByText(/Preço anterior/)).toBeNull()
  })

  it('mostra o preço anterior (sem riscado) quando é diferente', () => {
    renderWithProviders(<PriceTag price={eth('0.35')} previousPrice={eth('0.5')} size="sm" />)
    const previous = screen.getByText(/Preço anterior/).parentElement
    expect(previous?.textContent).toContain('0.5 ETH')
    expect(previous?.closest('s')).toBeNull()
  })

  it('ignora o preço anterior igual', () => {
    renderWithProviders(<PriceTag price={eth('0.5')} previousPrice={eth('0.5')} size="lg" />)
    expect(screen.queryByText(/Preço anterior/)).toBeNull()
  })

  it('tom accent: preço em laranja e negrito', () => {
    renderWithProviders(<PriceTag price={eth('0.5')} tone="accent" />)
    expect(screen.getByText(/Preço:/).parentElement?.className).toContain('text-text-accent')
  })

  it('alterado: "Subiu" quando o preço aumentou', () => {
    renderWithProviders(<PriceTag price={eth('0.6')} previousPrice={eth('0.5')} changed live />)
    expect(screen.getByText('Subiu')).toBeTruthy()
    const tag = document.querySelector('[data-slot="price-tag"]')
    expect(tag?.getAttribute('aria-live')).toBe('polite')
    expect(tag?.getAttribute('data-changed')).toBe('true')
  })

  it('alterado: "Caiu" quando o preço diminuiu', () => {
    renderWithProviders(<PriceTag price={eth('0.4')} previousPrice={eth('0.5')} changed />)
    expect(screen.getByText('Caiu')).toBeTruthy()
  })

  it('alterado sem preço anterior: "Atualizado"', () => {
    renderWithProviders(<PriceTag price={eth('0.4')} changed />)
    expect(screen.getByText('Atualizado')).toBeTruthy()
  })

  it('alterado com preço anterior igual: "Atualizado"', () => {
    renderWithProviders(<PriceTag price={eth('0.4')} previousPrice={eth('0.4')} changed />)
    expect(screen.getByText('Atualizado')).toBeTruthy()
  })
})
