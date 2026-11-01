// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/contracts'
import { makeNft, makePage, nftApiGet } from '@/test/nftFixtures'
import { renderWithProviders } from '@/test/render'
import { MoreFromCollection } from './MoreFromCollection'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/client', () => ({ apiClient: api }))
vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
vi.mock('@/features/favorites/useToggleFavorite', () => ({
  useToggleFavorite: () => ({ favorited: false, toggle: vi.fn(), pending: false, announcement: '' }),
}))

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

  it('pede 5 da coleção, tira o NFT atual e mostra no máximo 4', async () => {
    listOf(() => makePage([1, 2, 3, 4, 5].map((n) => makeNft(n))))
    renderWithProviders(<MoreFromCollection nft={current} />)
    expect(await screen.findAllByRole('article')).toHaveLength(4)
    expect(screen.queryByText('Obra 1')).toBeNull()
    expect(screen.getByText('Obra 5')).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Mais NFTs de Coleção A' })).toBeTruthy()
    expect(api.get).toHaveBeenCalledWith('/nfts', expect.objectContaining({ params: { collections: ['Coleção A'], pageSize: 5 } }))
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
