// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeNft } from '@/test/nftFixtures'
import '@/test/routerMock'
import { renderWithProviders } from '@/test/render'
import { NftGrid, NftGridSkeleton } from './NftGrid'

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
vi.mock('@/features/favorites/useToggleFavorite', () => ({
  useToggleFavorite: () => ({ favorited: false, toggle: vi.fn(), pending: false, announcement: '' }),
}))

const items = [makeNft(1), makeNft(2, { previousPrice: '0.5' as never }), makeNft(3)]

describe('NftGrid', () => {
  it('um card por NFT, com o rótulo padrão e sem favorito', () => {
    renderWithProviders(<NftGrid items={items} />)
    const list = screen.getByRole('list', { name: 'NFTs' })
    expect(list.getAttribute('aria-busy')).toBeNull()
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(/Preço anterior/)).toBeTruthy()
  })

  it('stale: aria-busy e opacidade reduzida; rótulo e classe próprios', () => {
    renderWithProviders(<NftGrid items={items} stale label="Resultados" className="extra" />)
    const list = screen.getByRole('list', { name: 'Resultados' })
    expect(list.getAttribute('aria-busy')).toBe('true')
    expect(list.className).toContain('opacity-60')
    expect(list.className).toContain('extra')
  })

  it('favoritable: cada card ganha o botão de favorito', () => {
    renderWithProviders(<NftGrid items={items} favoritable size="carousel" />)
    expect(screen.getAllByRole('button', { name: /Favoritar/ })).toHaveLength(3)
  })
})

describe('NftGridSkeleton', () => {
  it('renderiza count cards de skeleton', () => {
    const { container } = renderWithProviders(<NftGridSkeleton count={5} />)
    expect(container.querySelectorAll('[data-slot="nft-card-skeleton"]')).toHaveLength(5)
  })

  it('aceita tamanho e classe', () => {
    const { container } = renderWithProviders(<NftGridSkeleton count={2} size="carousel" className="extra" />)
    expect(container.querySelectorAll('[data-slot="nft-card-skeleton"]')).toHaveLength(2)
    expect(container.firstElementChild?.className).toContain('extra')
  })
})
