// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { setSearch } from '@/test/routerMock'
import { renderWithProviders } from '@/test/render'
import { CatalogPagination } from './CatalogPagination'

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())

describe('CatalogPagination', () => {
  it('uma página só: não renderiza', () => {
    const { container } = renderWithProviders(<CatalogPagination page={1} pageSize={12} total={12} />)
    expect(container.firstChild).toBeNull()
  })

  it('primeira página: sem "anterior", atual com aria-current, links com page e hash', () => {
    setSearch({ q: 'sol' })
    renderWithProviders(<CatalogPagination page={1} pageSize={12} total={30} />)
    expect(screen.queryByRole('link', { name: 'Página anterior' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Página 1' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Página 2' }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('link', { name: 'Página 1' }).getAttribute('href')).toBe('/?q=sol#catalogo')
    expect(screen.getByRole('link', { name: 'Página 3' }).getAttribute('href')).toBe('/?q=sol&page=3#catalogo')
    expect(screen.getByRole('link', { name: 'Próxima página' }).getAttribute('href')).toBe('/?q=sol&page=2#catalogo')
  })

  it('última página: sem "próxima"; "anterior" volta uma página (e à 1 sem page)', () => {
    renderWithProviders(<CatalogPagination page={3} pageSize={12} total={30} />)
    expect(screen.queryByRole('link', { name: 'Próxima página' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Página anterior' }).getAttribute('href')).toBe('/?page=2#catalogo')
    expect(screen.getByRole('link', { name: 'Página 3' }).getAttribute('aria-current')).toBe('page')
  })

  it('anterior da página 2 vai para a 1 (page sai da URL)', () => {
    renderWithProviders(<CatalogPagination page={2} pageSize={12} total={30} />)
    expect(screen.getByRole('link', { name: 'Página anterior' }).getAttribute('href')).toBe('/#catalogo')
  })

  it('muitas páginas: reticências nos buracos', () => {
    renderWithProviders(<CatalogPagination page={5} pageSize={12} total={12 * 20} />)
    expect(screen.getAllByText('…')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Página 20' })).toBeTruthy()
  })
})
