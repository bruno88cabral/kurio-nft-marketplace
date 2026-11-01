// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { parseEth } from '@/lib/eth'
import { FACETS, nftApiGet } from '@/test/nftFixtures'
import { navigateSpy, setSearch } from '@/test/routerMock'
import { renderWithProviders } from '@/test/render'
import { CatalogFilters } from './CatalogFilters'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/client', () => ({ apiClient: api }))
vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())

const facetsOf = (handler: () => unknown) => api.get.mockImplementation(nftApiGet({ facets: handler }))
/** Aplica o patch de `navigate({ search })` na busca dada, como o router faria. */
const lastSearch = (prev: Record<string, unknown> = {}) => {
  const arg = navigateSpy.mock.calls.at(-1)![0] as unknown as { search: (p: unknown) => unknown }
  return arg.search(prev)
}

describe('CatalogFilters', () => {
  it('enquanto as facetas carregam: skeleton e nenhum controle', () => {
    api.get.mockImplementation(() => new Promise(() => {}))
    const { container } = renderWithProviders(<CatalogFilters className="extra" />)
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBe(15)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull()
    expect(container.firstElementChild?.className).toContain('extra')
  })

  it('erro nas facetas: mensagem e "Tentar novamente" refaz a request (ignora clique durante o fetch)', async () => {
    facetsOf(() => Promise.reject(new Error('x')))
    renderWithProviders(<CatalogFilters />)
    expect(await screen.findByText('Não foi possível carregar os filtros.')).toBeTruthy()
    api.get.mockImplementation(() => new Promise(() => {}))
    const retry = screen.getByRole('button', { name: 'Tentar novamente' })
    fireEvent.click(retry)
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    fireEvent.click(retry)
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('erro nas facetas: o retry bem-sucedido mostra os filtros', async () => {
    facetsOf(() => Promise.reject(new Error('x')))
    renderWithProviders(<CatalogFilters />)
    const retry = await screen.findByRole('button', { name: 'Tentar novamente' })
    facetsOf(() => FACETS)
    fireEvent.click(retry)
    expect(await screen.findByRole('checkbox', { name: /Coleção A/ })).toBeTruthy()
  })

  it('coleções e redes com contagem; marcar uma coleção atualiza collections', async () => {
    facetsOf(() => FACETS)
    renderWithProviders(<CatalogFilters />)
    const a = await screen.findByRole('checkbox', { name: /Coleção A/ })
    expect(a.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('(7)')).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Todas/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('(10)')).toBeTruthy()
    fireEvent.click(a)
    expect(lastSearch({ q: 'x', page: 3 })).toMatchObject({ q: 'x', collections: ['Coleção A'], page: undefined })
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).toBeNull()
  })

  it('desmarcar uma coleção marcada remove só ela', async () => {
    setSearch({ collections: ['Coleção A', 'Coleção B'] })
    facetsOf(() => FACETS)
    renderWithProviders(<CatalogFilters />)
    const a = await screen.findByRole('checkbox', { name: /Coleção A/ })
    expect(a.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(a)
    expect(lastSearch({ collections: ['Coleção A', 'Coleção B'] })).toMatchObject({ collections: ['Coleção B'] })
  })

  it('sem coleções: mensagem', async () => {
    facetsOf(() => ({ ...FACETS, collections: [] }))
    renderWithProviders(<CatalogFilters />)
    expect(await screen.findByText('Nenhuma coleção.')).toBeTruthy()
  })

  it('rede: escolher uma aplica; "Todas" remove', async () => {
    setSearch({ network: 'polygon' })
    facetsOf(() => FACETS)
    renderWithProviders(<CatalogFilters />)
    expect((await screen.findByRole('radio', { name: /Polygon/ })).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('radio', { name: /Ethereum/ }))
    expect(lastSearch({})).toMatchObject({ network: 'ethereum' })
    fireEvent.click(screen.getByRole('radio', { name: /Todas/ }))
    expect(lastSearch({ network: 'polygon' })).toMatchObject({ network: undefined })
  })

  it('preço: o slider move o rascunho e "Aplicar" grava priceMin/priceMax', async () => {
    facetsOf(() => FACETS)
    renderWithProviders(<CatalogFilters />)
    const min = await screen.findByRole('slider', { name: 'Preço mínimo' })
    const max = screen.getByRole('slider', { name: 'Preço máximo' })
    expect(screen.getByText('Preço: 0.1 – 2 ETH')).toBeTruthy()
    fireEvent.focus(min)
    fireEvent.keyDown(min, { key: 'ArrowRight' })
    fireEvent.focus(max)
    fireEvent.keyDown(max, { key: 'ArrowLeft' })
    expect(screen.getByText('Preço: 0.11 – 1.99 ETH')).toBeTruthy()
    expect(min.getAttribute('aria-valuetext')).toBe('0.11 ETH')
    expect(max.getAttribute('aria-valuetext')).toBe('1.99 ETH')
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(lastSearch({})).toMatchObject({ priceMin: parseEth('0.11'), priceMax: parseEth('1.99') })
  })

  it('preço da URL parte do slider e "Aplicar" nos limites não filtra', async () => {
    setSearch({ priceMin: parseEth('0.5'), priceMax: parseEth('1') })
    facetsOf(() => FACETS)
    renderWithProviders(<CatalogFilters />)
    await screen.findByRole('slider', { name: 'Preço mínimo' })
    expect(screen.getByText('Preço: 0.5 – 1 ETH')).toBeTruthy()
    const min = screen.getByRole('slider', { name: 'Preço mínimo' })
    const max = screen.getByRole('slider', { name: 'Preço máximo' })
    fireEvent.focus(min)
    fireEvent.keyDown(min, { key: 'Home' })
    fireEvent.focus(max)
    fireEvent.keyDown(max, { key: 'End' })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(lastSearch({ priceMin: '0.5' })).toMatchObject({ priceMin: undefined, priceMax: undefined })
  })

  it('faixa única (min = max): slider e "Aplicar" desabilitados', async () => {
    facetsOf(() => ({ ...FACETS, price: { min: parseEth('1'), max: parseEth('1') } }))
    renderWithProviders(<CatalogFilters />)
    await screen.findByRole('slider', { name: 'Preço mínimo' })
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Aplicar' }).disabled).toBe(true)
  })

  it('"Limpar filtros" aparece com filtro ativo e zera coleções, rede e preço', async () => {
    setSearch({ collections: ['Coleção A'], network: 'polygon', priceMin: parseEth('0.5'), q: 'sol' })
    facetsOf(() => FACETS)
    renderWithProviders(<CatalogFilters />)
    fireEvent.click(await screen.findByRole('button', { name: 'Limpar filtros' }))
    expect(lastSearch({ collections: ['A'], network: 'polygon', priceMin: '0.5', q: 'sol' })).toMatchObject({
      q: 'sol',
      collections: undefined,
      network: undefined,
      priceMin: undefined,
    })
  })

  it('"Limpar filtros" também aparece com as facetas ainda carregando', () => {
    setSearch({ network: 'polygon' })
    api.get.mockImplementation(() => new Promise(() => {}))
    renderWithProviders(<CatalogFilters />)
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeTruthy()
  })
})
