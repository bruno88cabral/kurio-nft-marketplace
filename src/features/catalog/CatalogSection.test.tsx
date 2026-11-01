// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FACETS, makeNft, makePage, nftApiGet } from '@/test/nftFixtures'
import { navigateSpy, setSearch } from '@/test/routerMock'
import { renderWithProviders } from '@/test/render'
import { parseEth } from '@/lib/eth'
import { CatalogSection } from './CatalogSection'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/client', () => ({ apiClient: api }))
vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
vi.mock('@/features/favorites/useToggleFavorite', () => ({
  useToggleFavorite: () => ({ favorited: false, toggle: vi.fn(), pending: false, announcement: '' }),
}))

const items = [makeNft(1), makeNft(2)]
const serve = (featured: () => unknown = () => [makeNft(9, { name: 'Destaque', previousPrice: parseEth('0.9') })]) =>
  api.get.mockImplementation(nftApiGet({ list: () => makePage(items), facets: () => FACETS, featured }))
const spotlight = () => screen.getByText('NFT em destaque').closest('section')!

describe('CatalogSection', () => {
  it('monta filtros, abas, grade e o destaque "Oferta limitada"', async () => {
    serve()
    renderWithProviders(<CatalogSection />)
    expect(screen.getByRole('region', { name: 'Catálogo' }).id).toBe('catalogo')
    expect(await screen.findByRole('list', { name: 'Resultados do catálogo' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Filtros' })).toBeTruthy()
    expect(await screen.findByRole('checkbox', { name: /Coleção A/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Todos os NFTs' }).getAttribute('aria-selected')).toBe('true')
    expect(await within(spotlight()).findByText('Oferta limitada')).toBeTruthy()
    expect(within(spotlight()).getByRole('heading', { name: /NFT em destaque\s*Oferta limitada/ })).toBeTruthy()
    // Só a arte, sem nome nem preço visíveis: o nome fica para o leitor de tela no link
    expect((await within(spotlight()).findByRole('link', { name: 'Destaque' })).getAttribute('href')).toBe('/nfts/nft-009')
  })

  it('a aba vem da URL e trocar de aba atualiza tab', async () => {
    setSearch({ tab: 'trending' })
    serve()
    renderWithProviders(<CatalogSection />)
    expect(screen.getByRole('tab', { name: 'Em alta' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Novos lançamentos' }), { button: 0, ctrlKey: false })
    const arg = navigateSpy.mock.calls.at(-1)![0] as unknown as { search: (p: unknown) => unknown }
    expect(arg.search({ tab: 'trending', page: 2 })).toMatchObject({ tab: 'new', page: undefined })
    await screen.findByRole('list', { name: 'Resultados do catálogo' })
  })

  it('destaque carregando: skeleton da arte', () => {
    api.get.mockImplementation(() => new Promise(() => {}))
    renderWithProviders(<CatalogSection />)
    expect(spotlight().querySelector('[data-slot="skeleton"]')).toBeTruthy()
    expect(within(spotlight()).queryByRole('link')).toBeNull()
  })

  it.each([
    ['erro', () => Promise.reject(new Error('x'))],
    ['lista vazia', () => []],
  ])('destaque com %s: o bloco some', async (_, featured) => {
    serve(featured)
    renderWithProviders(<CatalogSection />)
    await screen.findByRole('list', { name: 'Resultados do catálogo' })
    await vi.waitFor(() => expect(screen.queryByText('NFT em destaque')).toBeNull())
  })
})
