// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { nftFacetsQuery } from '@/api/nfts'
import type { NftFacets } from '@/contracts'
import { validateCatalogSearch } from '@/lib/catalogSearch'
import { parseEth } from '@/lib/eth'
import { CatalogFilters } from './CatalogFilters'
import { CatalogMobileTopBar } from './CatalogMobileTopBar'
import { CatalogPagination } from './CatalogPagination'

// O Slider da faixa de preço (Radix) mede o tamanho com ResizeObserver, que o jsdom não tem
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const FACETS: NftFacets = {
  collections: [
    { name: 'Aurora Drift', count: 6 },
    { name: 'Neon Atlas', count: 6 },
  ],
  networks: [
    { network: 'ethereum', count: 9 },
    { network: 'polygon', count: 3 },
  ],
  price: { min: parseEth('0.03'), max: parseEth('5') },
}

/** Rota `/` de verdade (com o `validateSearch` do catálogo), para a URL ser a mesma do app. */
function renderAt(path: string, ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  queryClient.setQueryData(nftFacetsQuery().queryKey, FACETS)
  const rootRoute = createRootRoute()
  const home = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    validateSearch: validateCatalogSearch,
    component: () => <>{ui}</>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([home]),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

afterEach(cleanup)

describe('CatalogPagination', () => {
  it('só a página atual leva aria-current, mesmo com a busca de outras páginas contida na URL', async () => {
    renderAt('/?page=2', <CatalogPagination page={2} pageSize={12} total={36} />)
    const nav = await screen.findByRole('navigation', { name: 'Paginação do catálogo' })
    const current = within(nav)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page')
    expect(current.map((a) => a.getAttribute('aria-label'))).toEqual(['Página 2'])
  })
})

describe('CatalogFilters: sem checkbox e rádio visíveis, com a semântica', () => {
  it('coleções são checkboxes nomeados pelo texto e marcar um grava a coleção na URL', async () => {
    const router = renderAt('/', <CatalogFilters />)
    const group = await screen.findByRole('group', { name: 'Coleções' })
    const neon = within(group).getByRole('checkbox', { name: /Neon Atlas/ })
    expect(neon.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(neon)
    await waitFor(() => expect(router.state.location.search).toMatchObject({ collections: ['Neon Atlas'] }))
    await waitFor(() => expect(neon.getAttribute('aria-checked')).toBe('true'))
  })

  it('rede é um radiogroup: "Todas" marcado sem rede na URL, e escolher uma rede grava `network`', async () => {
    const router = renderAt('/', <CatalogFilters />)
    const group = await screen.findByRole('group', { name: 'Rede' })
    expect(within(group).getByRole('radio', { name: /Todas/ }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(within(group).getByRole('radio', { name: /Polygon/ }))
    await waitFor(() => expect(router.state.location.search).toMatchObject({ network: 'polygon' }))
    expect(within(group).getByRole('radio', { name: /Polygon/ }).getAttribute('aria-checked')).toBe('true')
  })
})

describe('CatalogMobileTopBar: busca e filtros no topo do Início mobile', () => {
  it('a busca grava `q`, volta à página 1 e mantém os filtros (mesma `?q=` do header)', async () => {
    const router = renderAt('/?network=polygon&page=3', <CatalogMobileTopBar />)
    const form = await screen.findByRole('search', { name: 'Buscar NFTs' })
    const input = within(form).getByRole('searchbox', { name: 'Explorar coleções' })
    fireEvent.change(input, { target: { value: 'reef' } })
    fireEvent.submit(form)
    await waitFor(() => expect(router.state.location.search).toEqual({ network: 'polygon', q: 'reef' }))
    expect(router.state.location.hash).toBe('catalogo')
  })

  it('o campo começa com o `q` da URL', async () => {
    renderAt('/?q=neon', <CatalogMobileTopBar />)
    const input = await screen.findByRole<HTMLInputElement>('searchbox', { name: 'Explorar coleções' })
    expect(input.value).toBe('neon')
  })

  it('o botão laranja abre o drawer de filtros e diz quantos filtros estão ativos', async () => {
    renderAt('/?network=polygon', <CatalogMobileTopBar />)
    fireEvent.click(await screen.findByRole('button', { name: 'Filtros (1 ativo)' }))
    const dialog = await screen.findByRole('dialog', { name: 'Filtros' })
    expect(within(dialog).getByRole('radiogroup')).toBeTruthy()
  })
})
