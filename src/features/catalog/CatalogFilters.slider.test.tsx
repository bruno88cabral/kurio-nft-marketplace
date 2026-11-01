// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FACETS, nftApiGet } from '@/test/nftFixtures'
import { renderWithProviders } from '@/test/render'
import { CatalogFilters } from './CatalogFilters'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/client', () => ({ apiClient: api }))
vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())

// Slider falso: o Radix sempre entrega os dois polos; aqui forçamos os valores ausentes e um polo fora da faixa
vi.mock('@/components/ui/slider', () => ({
  Slider: ({
    onValueChange,
    getThumbProps,
  }: {
    onValueChange: (v: number[]) => void
    getThumbProps: (i: number) => Record<string, string>
  }) => (
    <div>
      <button onClick={() => onValueChange([])}>vazio</button>
      <button onClick={() => onValueChange([20, 30])}>faixa</button>
      <output data-testid="thumb-2">{getThumbProps(2)['aria-valuetext']}</output>
    </div>
  ),
}))

describe('CatalogFilters (valores ausentes do slider)', () => {
  it('sem valores o rascunho cai nos limites; polo inexistente mostra 0 ETH', async () => {
    api.get.mockImplementation(nftApiGet({ facets: () => FACETS }))
    renderWithProviders(<CatalogFilters />)
    await screen.findByText('Preço: 0.1 – 2 ETH')
    expect(screen.getByTestId('thumb-2').textContent).toBe('0 ETH')
    fireEvent.click(screen.getByRole('button', { name: 'faixa' }))
    expect(screen.getByText('Preço: 0.2 – 0.3 ETH')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'vazio' }))
    expect(screen.getByText('Preço: 0.1 – 2 ETH')).toBeTruthy()
  })
})
