// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { Route } from './index'

// Rota real (createFileRoute de verdade); as seções da página viram stubs, que já têm testes próprios
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return (await import('@/test/routerMock')).routeModuleMock(actual)
})
vi.mock('@/features/catalog/HeroFeatured', () => ({ HeroFeatured: () => <p>hero</p> }))
vi.mock('@/features/catalog/CatalogSection', () => ({ CatalogSection: () => <p>catalogo</p> }))
vi.mock('@/features/catalog/PromoCards', () => ({ PromoCards: () => <p>promos</p> }))
vi.mock('@/features/catalog/MintJournal', () => ({ MintJournal: () => <p>diario</p> }))

const options = Route.options as unknown as {
  validateSearch: (s: Record<string, unknown>) => unknown
  loaderDeps: (a: { search: Record<string, unknown> }) => unknown
  loader: (a: { context: { queryClient: { prefetchQuery: (q: unknown) => Promise<void> } }; deps: unknown }) => void
  head: () => { meta: { title: string }[] }
  component: () => React.ReactNode
}

afterEach(() => vi.restoreAllMocks())

describe('rota /', () => {
  it('head define o título', () => {
    expect(options.head().meta).toEqual([{ title: 'Início · Kurio' }])
  })

  it('validateSearch descarta valores inválidos e mantém os válidos', () => {
    expect(options.validateSearch({ q: ' sol ', tab: 'new', sort: 'zzz', page: 'abc' })).toMatchObject({
      q: 'sol',
      tab: 'new',
      sort: undefined,
      page: undefined,
    })
  })

  it('loaderDeps traduz a busca em parâmetros da lista', () => {
    expect(options.loaderDeps({ search: { q: 'sol', page: 2 } })).toEqual({ q: 'sol', page: 2, pageSize: 12 })
    expect(options.loaderDeps({ search: {} })).toEqual({ page: 1, pageSize: 12 })
  })

  it('loader aquece destaques, facetas e a lista sem esperar (devolve undefined)', () => {
    const prefetchQuery = vi.fn<(query: unknown) => Promise<void>>(() => Promise.resolve())
    const deps = { page: 2, pageSize: 12 }
    expect(options.loader({ context: { queryClient: { prefetchQuery } }, deps })).toBeUndefined()
    const keys = prefetchQuery.mock.calls.map(([q]) => (q as { queryKey: unknown[] }).queryKey)
    expect(keys).toEqual([['nfts', 'featured'], ['nfts', 'facets'], ['nfts', 'list', deps]])
  })

  it('o componente monta hero, catálogo, promoções e diário', () => {
    const Component = options.component
    renderWithProviders(<Component />)
    expect(screen.getAllByText(/^(hero|catalogo|promos|diario)$/).map((e) => e.textContent)).toEqual([
      'hero',
      'catalogo',
      'promos',
      'diario',
    ])
  })
})
