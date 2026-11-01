// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { NftGallery } from './NftGallery'

afterEach(cleanup)

const nft = (images: string[]) => ({ name: 'Slate Vine', imageUrl: images[0], images })
const thumbs = () => screen.getAllByRole('button', { name: /^Slate Vine, imagem/ })
const pressed = () => thumbs().map((b) => b.getAttribute('aria-pressed'))
/** A arte principal é a primeira imagem (as miniaturas vêm depois no DOM). */
const mainAlt = () => screen.getAllByRole('img')[0].getAttribute('alt')

describe('NftGallery', () => {
  it('com N imagens: uma miniatura por imagem, a 1ª escolhida, e o clique troca a arte principal', () => {
    render(<NftGallery nft={nft(['/a.svg', '/b.svg', '/c.svg'])} />)
    expect(thumbs()).toHaveLength(3)
    expect(pressed()).toEqual(['true', 'false', 'false'])
    expect(mainAlt()).toBe('Slate Vine, imagem 1 de 3')

    fireEvent.click(thumbs()[2])
    expect(pressed()).toEqual(['false', 'false', 'true'])
    expect(mainAlt()).toBe('Slate Vine, imagem 3 de 3')
  })

  it('setas (←/→ e ↑/↓) trocam com volta circular e levam o foco', () => {
    render(<NftGallery nft={nft(['/a.svg', '/b.svg', '/c.svg', '/d.svg'])} />)
    const group = screen.getByRole('group', { name: 'Imagens do NFT' })
    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(pressed()).toEqual(['false', 'false', 'false', 'true'])
    expect(document.activeElement).toBe(thumbs()[3])
    fireEvent.keyDown(group, { key: 'ArrowDown' })
    expect(pressed()[0]).toBe('true')
    expect(document.activeElement).toBe(thumbs()[0])
    fireEvent.keyDown(group, { key: 'ArrowUp' })
    expect(pressed()[3]).toBe('true')
  })

  it('com 1 imagem a coluna continua (mesma caixa no desktop), com a única miniatura escolhida', () => {
    render(<NftGallery nft={nft(['/a.svg'])} />)
    expect(pressed()).toEqual(['true'])
    expect(mainAlt()).toBe('Slate Vine, imagem 1 de 1')
  })

  it('a lupa abre a arte ampliada num diálogo com o nome do NFT', () => {
    render(<NftGallery nft={nft(['/a.svg', '/b.svg'])} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar Slate Vine, imagem 1 de 2' }))
    const dialog = screen.getByRole('dialog', { name: 'Slate Vine' })
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('/a.svg')
  })
})
