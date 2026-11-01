// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/contracts'
import { makeNft, makePage, nftApiGet } from '@/test/nftFixtures'
import { renderWithProviders } from '@/test/render'
import { MoreFromCollection } from './MoreFromCollection'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/client', () => ({ apiClient: api }))
vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())

const current = { id: 'nft-001', collection: 'Coleção A' }
const listOf = (handler: (c?: { params?: unknown }) => unknown) => api.get.mockImplementation(nftApiGet({ list: handler }))

describe('MoreFromCollection', () => {
  it('carregando: skeleton com aviso para leitor de tela', () => {
    api.get.mockImplementation(() => new Promise(() => {}))
    const { container } = renderWithProviders(<MoreFromCollection nft={current} />)
    expect(screen.getByText('Carregando mais NFTs desta coleção…')).toBeTruthy()
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Mais desta coleção' })).toBeTruthy()
  })

  it('pede 6 da coleção, tira o NFT atual e mostra no máximo 5', async () => {
    listOf(() => makePage([1, 2, 3, 4, 5, 6, 7].map((n) => makeNft(n))))
    renderWithProviders(<MoreFromCollection nft={current} />)
    expect(await screen.findAllByRole('article')).toHaveLength(5)
    expect(screen.queryByText('Obra 1')).toBeNull()
    expect(screen.getByText('Obra 6')).toBeTruthy()
    expect(screen.queryByText('Obra 7')).toBeNull()
    expect(screen.getByRole('list', { name: 'Mais NFTs de Coleção A' })).toBeTruthy()
    expect(api.get).toHaveBeenCalledWith('/nfts', expect.objectContaining({ params: { collections: ['Coleção A'], pageSize: 6 } }))
    // Tudo cabe (o jsdom não mede): uma página só, sem dots
    expect(screen.queryByRole('group', { name: 'Páginas do carrossel' })).toBeNull()
  })

  it('sem outros NFTs na coleção a seção não aparece', async () => {
    listOf(() => makePage([makeNft(1)]))
    const { container } = renderWithProviders(<MoreFromCollection nft={current} />)
    await waitFor(() => expect(container.querySelector('section')).toBeNull())
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('erro fica na seção e "Tentar novamente" refaz a request', async () => {
    let calls = 0
    listOf(() => {
      if (++calls === 1) throw new ApiError({ code: 'transient', message: 'x' }, 500)
      return makePage([makeNft(2)])
    })
    renderWithProviders(<MoreFromCollection nft={current} className="mt-4" />)
    expect(await screen.findByText('Não foi possível carregar mais NFTs desta coleção.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }))
    expect(await screen.findByText('Obra 2')).toBeTruthy()
    expect(calls).toBe(2)
  })
})

describe('MoreFromCollection: dots do carrossel', () => {
  // O jsdom não tem layout: o trilho "mede" 200 px visíveis de 600 px (3 páginas)
  let scrollLeft = 0
  const scrollTo = vi.fn()

  function layout(clientWidth: number, scrollWidth: number) {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(clientWidth)
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scrollWidth)
    vi.spyOn(HTMLElement.prototype, 'scrollLeft', 'get').mockImplementation(() => scrollLeft)
    Element.prototype.scrollTo = scrollTo
  }

  afterEach(() => {
    vi.restoreAllMocks()
    scrollTo.mockReset()
    scrollLeft = 0
    vi.unstubAllGlobals()
  })

  const dots = () => screen.getAllByRole('button', { name: /^Página \d de 3$/ })
  const serveSix = () => listOf(() => makePage([2, 3, 4, 5, 6].map((n) => makeNft(n))))

  it('com mais cards do que cabem: um dot por página; clicar rola até ela e a rolagem marca a atual', async () => {
    layout(200, 600)
    serveSix()
    renderWithProviders(<MoreFromCollection nft={current} />)
    expect(await screen.findByRole('group', { name: 'Páginas do carrossel' })).toBeTruthy()
    expect(dots().map((d) => d.getAttribute('aria-current'))).toEqual(['true', null, null])

    fireEvent.click(dots()[2])
    expect(scrollTo).toHaveBeenCalledWith({ left: 400, behavior: 'smooth' })

    scrollLeft = 400
    fireEvent.scroll(screen.getByRole('list', { name: 'Mais NFTs de Coleção A' }))
    await waitFor(() => expect(dots().map((d) => d.getAttribute('aria-current'))).toEqual([null, null, 'true']))
    // Mesma medida de novo: o estado não muda
    fireEvent.scroll(screen.getByRole('list', { name: 'Mais NFTs de Coleção A' }))
    expect(dots()[2].getAttribute('aria-current')).toBe('true')
  })

  it('com movimento reduzido a rolagem é instantânea', async () => {
    layout(200, 600)
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query }))
    serveSix()
    renderWithProviders(<MoreFromCollection nft={current} />)
    await screen.findByRole('group', { name: 'Páginas do carrossel' })
    fireEvent.click(dots()[1])
    expect(scrollTo).toHaveBeenCalledWith({ left: 200, behavior: 'auto' })
  })

  it('sem matchMedia no ambiente a rolagem é suave', async () => {
    layout(200, 600)
    vi.stubGlobal('matchMedia', undefined)
    serveSix()
    renderWithProviders(<MoreFromCollection nft={current} />)
    await screen.findByRole('group', { name: 'Páginas do carrossel' })
    fireEvent.click(dots()[1])
    expect(scrollTo).toHaveBeenCalledWith({ left: 200, behavior: 'smooth' })
  })

  it('sem ResizeObserver no ambiente mede só na montagem e na rolagem', async () => {
    layout(200, 600)
    vi.stubGlobal('ResizeObserver', undefined)
    serveSix()
    const { unmount } = renderWithProviders(<MoreFromCollection nft={current} />)
    expect(await screen.findByRole('group', { name: 'Páginas do carrossel' })).toBeTruthy()
    unmount()
  })

  it('tudo cabendo na largura medida: uma página só, sem dots', async () => {
    layout(600, 600)
    serveSix()
    renderWithProviders(<MoreFromCollection nft={current} />)
    await screen.findByRole('list', { name: 'Mais NFTs de Coleção A' })
    expect(screen.queryByRole('group', { name: 'Páginas do carrossel' })).toBeNull()
  })
})
