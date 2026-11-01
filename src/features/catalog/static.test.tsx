// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import '@/test/routerMock'
import { renderWithProviders } from '@/test/render'
import { MintJournal } from './MintJournal'
import { PromoCards } from './PromoCards'

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())

describe('MintJournal', () => {
  it('lista os três posts com data, título e "Ler mais" fora do escopo', () => {
    renderWithProviders(<MintJournal />)
    expect(screen.getByRole('heading', { name: 'Diário da Cunhagem' })).toBeTruthy()
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.getByText('24 out 2026').getAttribute('datetime')).toBe('2026-10-24')
    const more = screen.getAllByRole('button', { name: /Ler mais: .* \(em breve\)/ })
    expect(more).toHaveLength(3)
    expect(more[0]?.getAttribute('aria-disabled')).toBe('true')
  })
})

describe('PromoCards', () => {
  it('"Explorar" abre a aba correspondente do catálogo', () => {
    renderWithProviders(<PromoCards />)
    expect(screen.getByRole('heading', { name: 'Novos lançamentos' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Explorar\s*novos lançamentos/ }).getAttribute('href')).toBe('/?tab=new#catalogo')
    expect(screen.getByRole('link', { name: /Explorar\s*em alta/ }).getAttribute('href')).toBe('/?tab=trending#catalogo')
  })
})
