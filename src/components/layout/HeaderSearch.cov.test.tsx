// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { navigateSpy, setSearch } from '@/test/routerMock'
import { renderWithProviders } from '@/test/render'
import { HeaderSearch } from './HeaderSearch'

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Buscar NFTs' }))

describe('HeaderSearch', () => {
  it('começa fechada e o ícone abre o campo vazio', () => {
    renderWithProviders(<HeaderSearch />)
    expect(screen.queryByRole('search')).toBeNull()
    open()
    expect(screen.getByRole('search')).toBeTruthy()
    expect(screen.getByLabelText<HTMLInputElement>('Buscar NFTs', { selector: 'input' }).value).toBe('')
    expect(screen.getByRole('button', { name: 'Fechar busca' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('preenche com o q atual e o envio navega para / com a busca e o hash', () => {
    setSearch({ q: 'sol', collections: ['Coleção A'], page: 3 })
    renderWithProviders(<HeaderSearch className="extra" />)
    open()
    const input = screen.getByLabelText<HTMLInputElement>('Buscar NFTs', { selector: 'input' })
    expect(input.value).toBe('sol')
    fireEvent.change(input, { target: { value: 'lua' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(navigateSpy.mock.calls[0]?.[0]).toMatchObject({
      to: '/',
      search: { q: 'lua', collections: ['Coleção A'], page: undefined },
      hash: 'catalogo',
    })
    expect(screen.queryByRole('search')).toBeNull()
  })

  it('fora do Início (sem busca da rota) começa de uma busca vazia', () => {
    setSearch(undefined)
    renderWithProviders(<HeaderSearch />)
    open()
    fireEvent.change(screen.getByLabelText('Buscar NFTs', { selector: 'input' }), { target: { value: 'x' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(navigateSpy.mock.calls[0]?.[0]).toMatchObject({ search: { q: 'x' } })
  })

  it('Esc fecha e devolve o foco ao ícone; outras teclas não fecham', () => {
    renderWithProviders(<HeaderSearch />)
    open()
    const form = screen.getByRole('search')
    fireEvent.keyDown(form, { key: 'a' })
    expect(screen.getByRole('search')).toBeTruthy()
    fireEvent.keyDown(form, { key: 'Escape' })
    expect(screen.queryByRole('search')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Buscar NFTs' }))
  })

  it('clicar no ícone aberto fecha', () => {
    renderWithProviders(<HeaderSearch />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar busca' }))
    expect(screen.queryByRole('search')).toBeNull()
  })

  it('valor de formulário que não é texto vira q vazio', () => {
    renderWithProviders(<HeaderSearch />)
    open()
    const form = screen.getByRole<HTMLFormElement>('search')
    // troca o input por um campo de arquivo: o FormData devolve File, não string
    form.querySelector('input')!.type = 'file'
    fireEvent.submit(form)
    expect(navigateSpy.mock.calls[0]?.[0]).toMatchObject({ search: { q: undefined } })
  })
})
