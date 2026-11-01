// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import type { ParsedLocation } from '@tanstack/react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { CATALOG_ANCHOR_ID, focusAfterNavigation, focusCatalog, focusCatalogIfLost, noteNavigationStart } from './routeFocus'
import { MAIN_CONTENT_ID } from './SkipLink'

const at = (pathname: string, hash = '') => ({ pathname, hash }) as ParsedLocation

function Page({ catalog = true, dialog = false, children }: { catalog?: boolean; dialog?: boolean; children?: React.ReactNode }) {
  return (
    <>
      <header>
        <a href="/cart">Carrinho</a>
      </header>
      <main id={MAIN_CONTENT_ID} tabIndex={-1}>
        {catalog && <section id={CATALOG_ANCHOR_ID} tabIndex={-1} />}
        {children}
      </main>
      {dialog && (
        <div role="dialog" aria-modal="true">
          <input aria-label="E-mail" />
        </div>
      )}
    </>
  )
}

const active = () => document.activeElement

afterEach(cleanup)

describe('focusAfterNavigation', () => {
  it('caminho novo: o foco sai do header (ou do <body>) para o <main>', () => {
    const { getByText, container } = render(<Page />)
    getByText('Carrinho').focus()
    focusAfterNavigation({ fromLocation: at('/'), toLocation: at('/cart'), pathChanged: true })
    expect(active()).toBe(container.querySelector('main'))
  })

  it('caminho novo com #catalogo: o foco vai para a seção do catálogo', () => {
    render(<Page />)
    focusAfterNavigation({ fromLocation: at('/cart'), toLocation: at('/', CATALOG_ANCHOR_ID), pathChanged: true })
    expect(active()?.id).toBe(CATALOG_ANCHOR_ID)
  })

  it('só a search mudou (filtro, página): o foco fica no controle', () => {
    const { getByText } = render(<Page />)
    getByText('Carrinho').focus()
    focusAfterNavigation({ fromLocation: at('/'), toLocation: at('/', CATALOG_ANCHOR_ID), pathChanged: false })
    expect(active()).toBe(getByText('Carrinho'))
  })

  it('primeira carga (sem fromLocation): não rouba o foco do skip link', () => {
    render(<Page />)
    focusAfterNavigation({ fromLocation: undefined, toLocation: at('/'), pathChanged: true })
    expect(active()).toBe(document.body)
  })

  it('a tela nova já focou algo no <main> ou abriu um diálogo modal: não mexe', () => {
    const { getByLabelText, unmount } = render(
      <Page>
        <input aria-label="Nome" autoFocus />
      </Page>,
    )
    focusAfterNavigation({ fromLocation: at('/'), toLocation: at('/profile'), pathChanged: true })
    expect(active()).toBe(getByLabelText('Nome'))
    unmount()

    const dialog = render(<Page dialog />)
    dialog.getByLabelText('E-mail').focus()
    focusAfterNavigation({ fromLocation: at('/'), toLocation: at('/login'), pathChanged: true })
    expect(active()).toBe(dialog.getByLabelText('E-mail'))
  })
})

describe('saindo de um modal (login, cadastro)', () => {
  it('fechou o modal (Esc): o foco volta ao controle que o abriu, se ele continua na página', () => {
    const { getByText, getByLabelText, rerender } = render(<Page />)
    getByText('Carrinho').focus() // o gatilho (o "Entrar" do header, na vida real)
    noteNavigationStart() // abre o login
    rerender(<Page dialog />)
    getByLabelText('E-mail').focus()
    noteNavigationStart() // fecha o login
    rerender(<Page />)
    expect(active()).toBe(document.body)
    focusAfterNavigation({ fromLocation: at('/login'), toLocation: at('/'), pathChanged: true })
    expect(active()).toBe(getByText('Carrinho'))
  })

  it('o gatilho sumiu (entrou na conta): o foco vai para o <main>', () => {
    const first = render(<Page />)
    first.getByText('Carrinho').focus()
    noteNavigationStart()
    first.unmount()
    const open = render(<Page dialog />)
    noteNavigationStart()
    open.unmount()
    const { container } = render(<Page />)
    focusAfterNavigation({ fromLocation: at('/login'), toLocation: at('/'), pathChanged: true })
    expect(active()).toBe(container.querySelector('main'))
  })

  it('sem modal no início da navegação, o link do header não segura o foco', () => {
    const { getByText, container } = render(<Page />)
    noteNavigationStart()
    getByText('Carrinho').focus()
    focusAfterNavigation({ fromLocation: at('/'), toLocation: at('/cart'), pathChanged: true })
    expect(active()).toBe(container.querySelector('main'))
  })
})

describe('focusCatalogIfLost', () => {
  it('foco no <body> (o campo da busca desmontou): vai para o catálogo', () => {
    render(<Page />)
    focusCatalogIfLost()
    expect(active()?.id).toBe(CATALOG_ANCHOR_ID)
  })

  it('o usuário já focou outro controle durante a busca: o foco fica nele', () => {
    const { getByText } = render(<Page />)
    getByText('Carrinho').focus()
    focusCatalogIfLost()
    expect(active()).toBe(getByText('Carrinho'))
  })
})

describe('focusCatalog', () => {
  it('fora do Início (sem a seção) cai no <main>', () => {
    const { container } = render(<Page catalog={false} />)
    focusCatalog()
    expect(active()).toBe(container.querySelector('main'))
  })
})
