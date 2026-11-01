// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Tabs } from '@/components/ui/tabs'
import { FACETS, nftApiGet } from '@/test/nftFixtures'
import { navigateSpy, setSearch } from '@/test/routerMock'
import { renderWithProviders } from '@/test/render'
import { CatalogToolbar } from './CatalogToolbar'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/client', () => ({ apiClient: api }))
vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())

const renderToolbar = () => {
  api.get.mockImplementation(nftApiGet({ facets: () => FACETS }))
  return renderWithProviders(
    <Tabs value="all">
      <CatalogToolbar />
    </Tabs>,
  )
}
const lastSearch = (prev: Record<string, unknown> = {}) => {
  const arg = navigateSpy.mock.calls.at(-1)![0] as unknown as { search: (p: unknown) => unknown }
  return arg.search(prev)
}

describe('CatalogToolbar', () => {
  it('mostra as três abas, "Filtros" sem contagem e a ordenação padrão', () => {
    renderToolbar()
    expect(screen.getByRole('tablist', { name: 'Recorte do catálogo' })).toBeTruthy()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Todos os NFTs', 'Novos lançamentos', 'Em alta'])
    expect(screen.getByRole('button', { name: 'Filtros' })).toBeTruthy()
    expect(screen.getByRole('combobox').textContent).toContain('Listados recentemente')
    expect(screen.queryByText(/Busca:/)).toBeNull()
  })

  it('a ordenação pelo Select muda sort', () => {
    renderToolbar()
    const trigger = screen.getByRole('combobox')
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
    fireEvent.click(screen.getByRole('option', { name: 'Menor preço' }))
    expect(lastSearch({ page: 2 })).toMatchObject({ sort: 'price_asc', page: undefined })
  })

  it('mostra a ordenação da URL', () => {
    setSearch({ sort: 'price_desc' })
    renderToolbar()
    expect(screen.getByRole('combobox').textContent).toContain('Maior preço')
  })

  it('"Filtros (n)" abre o drawer com os filtros e "Ver resultados" fecha', async () => {
    setSearch({ collections: ['Coleção A'], network: 'polygon' })
    renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Filtros (2)' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Filtros')).toBeTruthy()
    expect(await within(dialog).findByRole('checkbox', { name: /Coleção A/ })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ver resultados' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('chip da busca: mostra o termo e remover limpa q', () => {
    setSearch({ q: 'sol' })
    renderToolbar()
    expect(screen.getByText('Busca: sol')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remover busca "sol"' }))
    expect(lastSearch({ q: 'sol', tab: 'new' })).toMatchObject({ q: undefined, tab: 'new' })
  })
})
