// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { parseEth } from '@/lib/eth'
import { makeNft } from '@/test/nftFixtures'
import '@/test/routerMock'
import { renderWithProviders } from '@/test/render'
import { NftCard, NftCardSkeleton } from './NftCard'

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())

const SOLD_OUT = [{ kind: '1/1' as const, available: 0, total: 1 }]

describe('NftCard', () => {
  it('link para o detalhe, coleção, nome e preço', () => {
    renderWithProviders(<NftCard nft={makeNft(1)} />)
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/nfts/nft-001')
    expect(screen.getByText('Coleção A')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Obra 1' })).toBeTruthy()
    expect(link.textContent).toContain('0.35 ETH')
    expect(screen.queryByText('Esgotado')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(document.querySelector('img')?.getAttribute('loading')).toBe('lazy')
  })

  it('selo, preço anterior e prioridade (eager)', () => {
    renderWithProviders(<NftCard nft={makeNft(1)} badge="RARO" previousPrice={parseEth('0.5')} priority size="carousel" />)
    expect(screen.getByText('RARO')).toBeTruthy()
    expect(screen.getByText(/Preço anterior/)).toBeTruthy()
    const img = document.querySelector('img')
    expect(img?.getAttribute('loading')).toBe('eager')
    expect(img?.getAttribute('fetchpriority')).toBe('high')
  })

  it('esgotado: selo com texto e marca no card', () => {
    renderWithProviders(<NftCard nft={makeNft(1, { editions: SOLD_OUT })} />)
    expect(screen.getByText('Esgotado')).toBeTruthy()
    expect(document.querySelector('[data-slot="nft-card"]')?.getAttribute('data-sold-out')).toBe('true')
  })

  it('favorito: só aparece com onFavoriteToggle e chama o callback', () => {
    const onToggle = vi.fn()
    renderWithProviders(
      <NftCard nft={makeNft(1)} onFavoriteToggle={onToggle} favorited favoriteDisabled={false} favoriteClassName="md:hidden" />,
    )
    const button = screen.getByRole('button', { name: /Favoritar Obra 1/ })
    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('favorito no carrossel usa outra posição', () => {
    renderWithProviders(<NftCard nft={makeNft(1)} onFavoriteToggle={() => {}} size="carousel" />)
    expect(screen.getByRole('button', { name: /Favoritar/ }).className).toContain('top-4')
  })
})

describe('NftCardSkeleton', () => {
  it('grid e carrossel', () => {
    renderWithProviders(
      <>
        <NftCardSkeleton />
        <NftCardSkeleton size="carousel" className="x" />
      </>,
    )
    expect(document.querySelectorAll('[data-slot="nft-card-skeleton"]')).toHaveLength(2)
  })
})
