// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Favorite } from '@/contracts'
import { makeNft } from '@/test/nftFixtures'
import { renderWithProviders } from '@/test/render'
import { ANA, sessionOf } from '@/test/session'
import { FavoritableNftCard, NftFavoriteButton } from './FavoriteButton'

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), session: ((): { current: unknown } => ({ current: null }))() }))
vi.mock('@/api/client', () => ({ apiClient: { get: mocks.get, put: mocks.put, delete: vi.fn() } }))
vi.mock('@/auth/useSession', () => ({ useSession: () => mocks.session.current }))
vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())

const nft = makeNft(1, { name: 'Obra 1' })
const list = (items: Favorite[]) => mocks.get.mockResolvedValue({ data: items })

beforeEach(() => {
  mocks.get.mockReset()
  mocks.put.mockReset().mockResolvedValue({})
  mocks.session.current = sessionOf(ANA)
})

describe('NftFavoriteButton', () => {
  it('liga o botão do kit ao hook: reflete o cache, alterna e anuncia na região aria-live', async () => {
    list([])
    mocks.put.mockImplementation(() => {
      list([{ nftId: nft.id, createdAt: '2026-01-01T00:00:00.000Z' }])
      return Promise.resolve({})
    })
    renderWithProviders(<NftFavoriteButton nft={nft} className="x" />)
    const button = await screen.findByRole('button', { name: /Favoritar/ })
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
    expect(button.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(button)
    await waitFor(() => expect(button.getAttribute('aria-pressed')).toBe('true'))
    await waitFor(() => expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe('Adicionado aos favoritos.'))
  })

  it('variante overlay chega ao botão do kit', async () => {
    list([])
    renderWithProviders(<NftFavoriteButton nft={nft} variant="overlay" />)
    expect((await screen.findByRole('button', { name: 'Favoritar Obra 1' })).getAttribute('aria-pressed')).toBe('false')
  })
})

describe('FavoritableNftCard', () => {
  it('renderiza o card com o favorito ligado ao hook (só mobile) e a região aria-live', async () => {
    list([{ nftId: nft.id, createdAt: '2026-01-01T00:00:00.000Z' }])
    renderWithProviders(<FavoritableNftCard nft={nft} />)
    const heart = await screen.findByRole('button', { name: 'Favoritar Obra 1' })
    await waitFor(() => expect(heart.getAttribute('aria-pressed')).toBe('true'))
    expect(heart.className).toContain('md:hidden')
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy()
  })
})
