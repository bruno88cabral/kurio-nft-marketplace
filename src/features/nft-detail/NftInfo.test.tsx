// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { parseEth } from '@/lib/eth'
import { makeNft } from '@/test/nftFixtures'
import { renderWithProviders } from '@/test/render'
import { DETAIL_ASIDE_CLASS, DETAIL_GRID_CLASS, DETAIL_PAGE_CLASS } from './layout'
import { NftDetailSkeleton } from './NftDetailSkeleton'
import { NftBreadcrumb, NftDescription, NftInfo } from './NftInfo'

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())

describe('NftBreadcrumb', () => {
  it('Início › coleção (catálogo filtrado) › nome atual', () => {
    renderWithProviders(<NftBreadcrumb nft={makeNft(1, { name: 'Obra X', collection: 'Coleção A' })} className="x" />)
    expect(screen.getByRole('navigation', { name: 'Trilha de navegação' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('href')).toBe('/')
    const collection = screen.getByRole('link', { name: 'Coleção A' }).getAttribute('href') ?? ''
    expect(collection.endsWith('#catalogo')).toBe(true)
    expect(collection).toBe('/?collections=%5B%22Cole%C3%A7%C3%A3o+A%22%5D#catalogo')
    expect(screen.getByText('Obra X').getAttribute('aria-current')).toBe('page')
  })
})

describe('NftInfo', () => {
  it('coleção, nome, criador, rede e preço', () => {
    renderWithProviders(<NftInfo nft={makeNft(1, { name: 'Obra X', creator: 'Maria', network: 'polygon' })} className="x" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Obra X' })).toBeTruthy()
    expect(screen.getByText('Coleção A')).toBeTruthy()
    expect(screen.getByText('Criador').nextElementSibling?.textContent).toBe('Maria')
    expect(screen.getByText('Rede').nextElementSibling?.textContent).toBe('Polygon')
    expect(document.body.textContent).toContain('0.35')
  })

  it('mostra o preço anterior quando existe', () => {
    renderWithProviders(<NftInfo nft={makeNft(1, { previousPrice: parseEth('0.4') })} />)
    expect(document.querySelector('s, del, [class*="line-through"]')).toBeTruthy()
  })
})

describe('NftDescription', () => {
  it('seção com título e texto', () => {
    renderWithProviders(<NftDescription description="Texto longo" className="x" />)
    expect(screen.getByRole('heading', { name: 'Descrição' })).toBeTruthy()
    expect(screen.getByText('Texto longo')).toBeTruthy()
  })
})

describe('NftDetailSkeleton', () => {
  it('anuncia o carregamento, fica aria-busy e usa as mesmas caixas do Detalhe', () => {
    const { container } = renderWithProviders(<NftDetailSkeleton />)
    expect(screen.getByRole('status').textContent).toBe('Carregando NFT…')
    expect(container.querySelector('[aria-busy="true"]')?.className).toBe(DETAIL_PAGE_CLASS)
    expect(container.querySelector('.' + DETAIL_GRID_CLASS.split(' ')[0])).toBeTruthy()
    expect(DETAIL_ASIDE_CLASS).toContain('flex-col')
  })
})
