// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { parseEth } from '@/lib/eth'
import { makeNft } from '@/test/nftFixtures'
import { renderWithProviders } from '@/test/render'
import { historyBackSpy, navigateSpy } from '@/test/routerMock'
import { DETAIL_GRID_CLASS, DETAIL_PAGE_CLASS } from './layout'
import { NftDetailSkeleton } from './NftDetailSkeleton'
import { NftBreadcrumb, NftDescription, NftFacts, NftInfo } from './NftInfo'

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())

describe('NftBreadcrumb', () => {
  it('"Início / Mercado": o Mercado leva à seção do catálogo', () => {
    renderWithProviders(<NftBreadcrumb className="x" />)
    expect(screen.getByRole('navigation', { name: 'Trilha de navegação' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('link', { name: 'Mercado' }).getAttribute('href')).toBe('/#catalogo')
  })
})

describe('NftInfo', () => {
  it('nome (h1) e preço em destaque, anunciado só onde aparece', () => {
    const { container } = renderWithProviders(<NftInfo nft={makeNft(1, { name: 'Obra X' })} className="x" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Obra X' })).toBeTruthy()
    const price = container.querySelector('[data-slot="price-tag"]')
    expect(price?.textContent).toContain('0.35')
    expect(price?.getAttribute('aria-live')).toBe('polite')
    expect(price?.className).toContain('hidden md:inline-flex')
  })

  it('mostra o preço anterior quando existe', () => {
    renderWithProviders(<NftInfo nft={makeNft(1, { previousPrice: parseEth('0.4') })} />)
    expect(screen.getByText(/Preço anterior/).parentElement?.textContent).toContain('0.4')
  })
})

describe('NftDescription', () => {
  it('seção nomeada por "Sobre este NFT:" com o texto', () => {
    renderWithProviders(<NftDescription description="Texto longo" className="x" />)
    expect(screen.getByRole('region', { name: 'Sobre este NFT:' })).toBeTruthy()
    expect(screen.getByText('Texto longo')).toBeTruthy()
  })
})

describe('NftFacts', () => {
  it('coleção e criador numa lista de definições', () => {
    renderWithProviders(<NftFacts nft={makeNft(1, { collection: 'Coleção A', creator: 'Maria' })} className="x" />)
    expect(screen.getByText('Coleção:').nextElementSibling?.textContent).toBe('Coleção A')
    expect(screen.getByText('Criador:').nextElementSibling?.textContent).toBe('Maria')
  })
})

describe('NftDetailSkeleton', () => {
  it('anuncia o carregamento, fica aria-busy e usa as mesmas caixas do Detalhe', () => {
    const { container } = renderWithProviders(<NftDetailSkeleton />)
    expect(screen.getByRole('status').textContent).toBe('Carregando NFT…')
    expect(container.querySelector('[aria-busy="true"]')?.className).toBe(DETAIL_PAGE_CLASS)
    expect(container.querySelector('.' + DETAIL_GRID_CLASS.split(' ')[0])).toBeTruthy()
  })

  it('o "Voltar" do mobile já funciona enquanto carrega', () => {
    renderWithProviders(<NftDetailSkeleton />)
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/' })
    expect(historyBackSpy).not.toHaveBeenCalled()
  })
})
