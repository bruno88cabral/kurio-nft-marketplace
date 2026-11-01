// @vitest-environment jsdom
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { NftDetails } from './NftDetails'
import { ShareNft } from './PurchasePanel'

describe('NftDetails', () => {
  it('"Detalhes do NFT" com a rede e as edições na ordem canônica; a esgotada aparece como tal', () => {
    renderWithProviders(
      <NftDetails
        className="x"
        nft={{
          network: 'polygon',
          editions: [
            { kind: 'open', available: 0, total: 100 },
            { kind: '1/10', available: 7, total: 10 },
          ],
        }}
      />,
    )
    const section = screen.getByRole('region', { name: 'Detalhes do NFT' })
    expect(within(section).getByText('Rede:').nextElementSibling?.textContent).toBe('Polygon')
    const items = within(section).getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toHaveLength(2)
    expect(items[0]).toContain('7 de 10 disponíveis')
    expect(items[1]).toContain('esgotada')
    // Avaliações: fora do escopo ("Em breve")
    expect(within(section).getByRole('button', { name: /Avaliações de colecionadores/ }).getAttribute('aria-disabled')).toBe('true')
  })
})

describe('ShareNft', () => {
  it('LinkedIn, e-mail e Twitter, todos "Em breve"', () => {
    renderWithProviders(<ShareNft className="x" />)
    expect(screen.getByText('Compartilhar este NFT:')).toBeTruthy()
    for (const name of [/Compartilhar no LinkedIn/, /Compartilhar por e-mail/, /Compartilhar no Twitter/]) {
      expect(screen.getByRole('button', { name }).getAttribute('aria-disabled')).toBe('true')
    }
  })
})
