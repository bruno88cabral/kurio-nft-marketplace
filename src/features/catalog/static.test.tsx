// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import '@/test/routerMock'
import { renderWithProviders } from '@/test/render'
import { MintJournal } from './MintJournal'
import { PromoCards } from './PromoCards'

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())

describe('MintJournal', () => {
  it('lista os quatro posts com data, título e "Ler mais" fora do escopo', () => {
    renderWithProviders(<MintJournal />)
    expect(screen.getByRole('heading', { name: 'Diário da Cunhagem' })).toBeTruthy()
    expect(screen.getAllByRole('article')).toHaveLength(4)
    expect(screen.getByText('12 de setembro').getAttribute('datetime')).toBe('2026-09-12')
    const more = screen.getAllByRole('button', { name: /Ler mais: .* \(em breve\)/ })
    expect(more).toHaveLength(4)
    expect(more[0]?.getAttribute('aria-disabled')).toBe('true')
  })
})

describe('PromoCards', () => {
  it('"Explorar" abre a aba correspondente do catálogo', () => {
    renderWithProviders(<PromoCards />)
    expect(screen.getByRole('region', { name: 'Coleções em destaque' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Lançamentos gênesis de edição limitada' })).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /Explorar\s*lançamentos gênesis de edição limitada/ }).getAttribute('href'),
    ).toBe('/?tab=new#catalogo')
    expect(
      screen.getByRole('link', { name: /Explorar\s*arte digital selecionada e muito mais/ }).getAttribute('href'),
    ).toBe('/?tab=trending#catalogo')
  })
})
