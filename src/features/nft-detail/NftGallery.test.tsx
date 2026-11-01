// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { nftArtSize } from '@/lib/nftArt'
import { makeNft } from '@/test/nftFixtures'
import { renderWithProviders } from '@/test/render'
import { NftGallery } from './NftGallery'

const ART = ['/nfts/solar-veil.svg', '/nfts/atlas-zero.svg', '/nfts/aurora-prime.svg']
const main = () => screen.getAllByRole('img')[0] as HTMLImageElement
const thumbsOf = () => within(screen.getByRole('group', { name: 'Imagens do NFT' })).getAllByRole('button')

describe('NftGallery', () => {
  it('com uma imagem só: arte principal com alt numerado; a coluna de miniaturas some só no mobile', () => {
    renderWithProviders(<NftGallery nft={makeNft(1, { name: 'Obra' })} />)
    expect(main().alt).toBe('Obra, imagem 1 de 1')
    expect(main().getAttribute('src')).toBe('/nfts/solar-veil.svg')
    expect(main().width).toBe(nftArtSize('/nfts/solar-veil.svg').width)
    expect(thumbsOf()).toHaveLength(1)
    expect(screen.getByRole('group', { name: 'Imagens do NFT' }).parentElement?.className).toContain('max-md:hidden')
  })

  it('sem lista de imagens usa imageUrl como única imagem', () => {
    renderWithProviders(<NftGallery nft={makeNft(1, { images: [], imageUrl: '/nfts/atlas-zero.svg' })} />)
    expect(main().getAttribute('src')).toBe('/nfts/atlas-zero.svg')
    expect(thumbsOf()).toHaveLength(1)
  })

  it('com várias imagens a coluna aparece também no mobile', () => {
    renderWithProviders(<NftGallery nft={makeNft(1, { images: ART })} />)
    expect(screen.getByRole('group', { name: 'Imagens do NFT' }).parentElement?.className).not.toContain('max-md:hidden')
  })

  it('a lupa abre a arte atual ampliada num diálogo', () => {
    renderWithProviders(<NftGallery nft={makeNft(1, { name: 'Obra', images: ART })} />)
    fireEvent.click(thumbsOf()[1])
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar Obra, imagem 2 de 3' }))
    const dialog = screen.getByRole('dialog', { name: 'Obra' })
    expect(within(dialog).getByRole('img').getAttribute('src')).toBe(ART[1])
  })

  it('miniatura troca a imagem principal e marca só a atual com aria-pressed', () => {
    renderWithProviders(<NftGallery nft={makeNft(1, { name: 'Obra', images: ART })} />)
    const thumbs = thumbsOf()
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
    const thumbs = thumbsOf()
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
