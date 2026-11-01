// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeNft } from '@/test/nftFixtures'
import { renderWithProviders } from '@/test/render'
import { NftGallery } from './NftGallery'

const ART = ['/nfts/solar-veil.svg', '/nfts/atlas-zero.svg', '/nfts/aurora-prime.svg']
const main = () => screen.getAllByRole('img')[0] as HTMLImageElement

describe('NftGallery', () => {
  it('com uma imagem só: arte principal com alt numerado e sem miniaturas', () => {
    renderWithProviders(<NftGallery nft={makeNft(1, { name: 'Obra' })} />)
    expect(main().alt).toBe('Obra, imagem 1 de 1')
    expect(main().getAttribute('src')).toBe('/nfts/solar-veil.svg')
    expect(main().width).toBe(120)
    expect(screen.queryByRole('group', { name: 'Imagens do NFT' })).toBeNull()
  })

  it('sem lista de imagens usa imageUrl como única imagem', () => {
    renderWithProviders(<NftGallery nft={makeNft(1, { images: [], imageUrl: '/nfts/atlas-zero.svg' })} />)
    expect(main().getAttribute('src')).toBe('/nfts/atlas-zero.svg')
    expect(screen.queryByRole('group')).toBeNull()
  })

  it('miniatura troca a imagem principal e marca só a atual com aria-pressed', () => {
    renderWithProviders(<NftGallery nft={makeNft(1, { name: 'Obra', images: ART })} />)
    const thumbs = screen.getAllByRole('button')
    expect(thumbs).toHaveLength(3)
    expect(thumbs.map((t) => t.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    fireEvent.click(thumbs[2])
    expect(main().getAttribute('src')).toBe(ART[2])
    expect(main().alt).toBe('Obra, imagem 3 de 3')
    expect(thumbs.map((t) => t.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
  })

  it('setas trocam a imagem, dão a volta nas pontas e levam o foco; outras teclas são ignoradas', () => {
    renderWithProviders(<NftGallery nft={makeNft(1, { images: ART })} />)
    const group = screen.getByRole('group', { name: 'Imagens do NFT' })
    const thumbs = screen.getAllByRole('button')
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(main().getAttribute('src')).toBe(ART[1])
    expect(document.activeElement).toBe(thumbs[1])
    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(main().getAttribute('src')).toBe(ART[2])
    expect(document.activeElement).toBe(thumbs[2])
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(main().getAttribute('src')).toBe(ART[0])
    fireEvent.keyDown(group, { key: 'Enter' })
    expect(main().getAttribute('src')).toBe(ART[0])
  })
})
