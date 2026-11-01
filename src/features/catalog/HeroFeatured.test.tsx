// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeNft, nftApiGet } from '@/test/nftFixtures'
import '@/test/routerMock'
import { renderWithProviders } from '@/test/render'
import { HeroFeatured } from './HeroFeatured'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/client', () => ({ apiClient: api }))
vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())

const featured = [makeNft(1, { name: 'Primeira' }), makeNft(2, { name: 'Segunda' }), makeNft(3, { name: 'Terceira' })]

describe('HeroFeatured', () => {
  it('texto fixo e CTA que mantém os filtros da URL, com skeleton enquanto carrega', () => {
    api.get.mockImplementation(() => new Promise(() => {}))
    const { container } = renderWithProviders(<HeroFeatured />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Seja dono do futuro')
    // Dois CTAs "Explorar" (texto no mobile, botão no desktop), ambos para o catálogo mantendo a URL
    const ctas = screen.getAllByRole('link', { name: /Explorar/ })
    expect(ctas).toHaveLength(2)
    for (const cta of ctas) expect(cta.getAttribute('href')).toBe('/#catalogo')
    expect(container.querySelector('[data-slot="skeleton"][aria-hidden="true"]')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Destaques' })).toBeNull()
  })

  it.each([
    ['erro', () => Promise.reject(new Error('boom'))],
    ['lista vazia', () => []],
  ])('%s: mantém a caixa com a mensagem de indisponível', async (_, featuredHandler) => {
    api.get.mockImplementation(nftApiGet({ featured: featuredHandler }))
    renderWithProviders(<HeroFeatured />)
    expect(await screen.findByText('Destaques indisponíveis no momento.')).toBeTruthy()
  })

  it('mostra o destaque com link para o detalhe e navega pelos dots e pelo teclado', async () => {
    api.get.mockImplementation(nftApiGet({ featured: () => featured }))
    renderWithProviders(<HeroFeatured />)
    const region = await screen.findByRole('region', { name: 'Destaques' })
    const slide = () => screen.getByRole('link', { name: /Obra|Primeira|Segunda|Terceira/ })
    expect(slide().getAttribute('href')).toBe('/nfts/nft-001')
    expect(slide().textContent).toContain('Primeira')
    expect(document.querySelector('img')?.getAttribute('fetchpriority')).toBe('high')
    expect(screen.getByText('Destaque 1 de 3: Primeira')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Destaque 1 de 3' }).getAttribute('aria-current')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Destaque 2 de 3' }))
    expect(slide().getAttribute('href')).toBe('/nfts/nft-002')
    expect(document.querySelector('img')?.hasAttribute('fetchpriority')).toBe(false)
    expect(screen.getByRole('button', { name: 'Destaque 1 de 3' }).hasAttribute('aria-current')).toBe(false)

    fireEvent.keyDown(region, { key: 'ArrowRight' })
    expect(slide().getAttribute('href')).toBe('/nfts/nft-003')
    fireEvent.keyDown(region, { key: 'ArrowRight' })
    expect(slide().getAttribute('href')).toBe('/nfts/nft-001')
    fireEvent.keyDown(region, { key: 'ArrowLeft' })
    expect(slide().getAttribute('href')).toBe('/nfts/nft-003')
  })

  it('outras teclas não trocam o slide nem são interceptadas', async () => {
    api.get.mockImplementation(nftApiGet({ featured: () => featured }))
    renderWithProviders(<HeroFeatured />)
    const region = await screen.findByRole('region', { name: 'Destaques' })
    expect(fireEvent.keyDown(region, { key: 'a' })).toBe(true)
    expect(screen.getByText('Destaque 1 de 3: Primeira')).toBeTruthy()
    expect(fireEvent.keyDown(region, { key: 'ArrowRight' })).toBe(false)
  })
})
