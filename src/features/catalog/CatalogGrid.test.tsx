// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { makeNft, makePage, nftApiGet } from '@/test/nftFixtures'
import { navigateSpy, setSearch } from '@/test/routerMock'
import { renderWithProviders } from '@/test/render'
import { CatalogGrid } from './CatalogGrid'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/client', () => ({ apiClient: api }))
vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
vi.mock('@/features/favorites/useToggleFavorite', () => ({
  useToggleFavorite: () => ({ favorited: false, toggle: vi.fn(), pending: false, announcement: '' }),
}))

const twelve = Array.from({ length: 12 }, (_, i) => makeNft(i + 1))
const listOf = (handler: () => unknown) => api.get.mockImplementation(nftApiGet({ list: handler }))

describe('CatalogGrid', () => {
  it('carregando: skeleton com 12 cards e aviso para leitor de tela', () => {
    api.get.mockImplementation(() => new Promise(() => {}))
    const { container } = renderWithProviders(<CatalogGrid />)
    expect(screen.getByText('Carregando NFTs…')).toBeTruthy()
    expect(container.querySelectorAll('[data-slot="nft-card-skeleton"]')).toHaveLength(12)
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
  })

  it('sucesso: 12 cards, total anunciado e paginação; pede a página da URL com o tamanho do catálogo', async () => {
    setSearch({ q: 'sol', page: 2 })
    listOf(() => makePage(twelve, { total: 30, page: 2 }))
    renderWithProviders(<CatalogGrid />)
    expect(await screen.findAllByRole('article')).toHaveLength(12)
    expect(screen.getByRole('status').textContent).toBe('30 NFTs encontrados')
    expect(screen.getByRole('navigation', { name: 'Paginação do catálogo' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Favoritar/ })).toHaveLength(12)
    expect(api.get).toHaveBeenCalledWith('/nfts', expect.objectContaining({ params: { q: 'sol', page: 2, pageSize: 12 } }))
  })

  it('um resultado só: singular, sem paginação', async () => {
    listOf(() => makePage([makeNft(1)]))
    renderWithProviders(<CatalogGrid />)
    await screen.findByRole('article')
    expect(screen.getByRole('status').textContent).toBe('1 NFT encontrado')
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('vazio: EmptyState e "Limpar filtros" zera os filtros e a busca', async () => {
    listOf(() => makePage([]))
    renderWithProviders(<CatalogGrid />)
    expect(await screen.findByText('Nenhum NFT encontrado')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    const arg = navigateSpy.mock.calls[0][0] as unknown as { search: (p: unknown) => unknown }
    expect(arg.search({ q: 'x', network: 'polygon', collections: ['A'], priceMin: '1', tab: 'new', page: 2 })).toMatchObject({
      q: undefined,
      network: undefined,
      collections: undefined,
      priceMin: undefined,
      tab: 'new',
      page: undefined,
    })
  })

  it('página inexistente: aponta para a última (plural)', async () => {
    setSearch({ q: 'sol', page: 9 })
    listOf(() => makePage([], { total: 30, page: 9 }))
    renderWithProviders(<CatalogGrid />)
    expect(await screen.findByText('Página não existe')).toBeTruthy()
    expect(screen.getByText('O catálogo tem 3 páginas com esses filtros.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir para a última página' }).getAttribute('href')).toBe('/?q=sol&page=3#catalogo')
  })

  it('página inexistente com uma página só: singular e sem page na URL', async () => {
    setSearch({ page: 2 })
    listOf(() => makePage([], { total: 5, page: 2 }))
    renderWithProviders(<CatalogGrid />)
    expect(await screen.findByText('O catálogo tem 1 página com esses filtros.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir para a última página' }).getAttribute('href')).toBe('/#catalogo')
  })

  it('erro: ErrorState e "Tentar novamente" refaz a request e mostra os cards', async () => {
    listOf(() => Promise.reject(new Error('503')))
    renderWithProviders(<CatalogGrid />)
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível carregar os NFTs.')
    expect(screen.getByText('Verifique sua conexão e tente de novo.')).toBeTruthy()
    expect(screen.queryAllByRole('article')).toHaveLength(0)
    expect(api.get).toHaveBeenCalledTimes(1)

    listOf(() => makePage(twelve))
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findAllByRole('article')).toHaveLength(12)
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('erro: durante o retry volta o skeleton (sem dado, a query fica pendente)', async () => {
    listOf(() => Promise.reject(new Error('offline')))
    renderWithProviders(<CatalogGrid />)
    const retry = await screen.findByRole('button', { name: 'Tentar novamente' })
    api.get.mockImplementation(() => new Promise(() => {}))
    fireEvent.click(retry)
    expect(await screen.findByText('Carregando NFTs…')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('troca de filtro: o dado anterior fica na tela, esmaecido, sem anunciar até chegar o novo', async () => {
    listOf(() => makePage(twelve, { total: 12 }))
    const { rerender, queryClient } = renderWithProviders(<CatalogGrid />)
    await screen.findAllByRole('article')
    setSearch({ tab: 'trending' })
    api.get.mockImplementation(() => new Promise(() => {}))
    rerender(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <CatalogGrid />
        </TooltipProvider>
      </QueryClientProvider>,
    )
    await waitFor(() => expect(screen.getByRole('list', { name: 'Resultados do catálogo' }).getAttribute('aria-busy')).toBe('true'))
    expect(screen.getAllByRole('article')).toHaveLength(12)
    expect(screen.getByRole('status').textContent).toBe('')
  })
})
