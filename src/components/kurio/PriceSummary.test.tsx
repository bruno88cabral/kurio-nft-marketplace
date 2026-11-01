// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { parseEth } from '@/lib/eth'
import { PriceSummary } from './PriceSummary'

const quote = {
  subtotal: parseEth('1.2'),
  discount: parseEth('0'),
  networkFee: parseEth('0.002'),
  total: parseEth('1.202'),
  coupon: undefined,
}

afterEach(cleanup)

describe('PriceSummary: cotação desatualizada anunciada', () => {
  it('a região role=status já existe vazia e recebe o aviso quando a cotação fica desatualizada', () => {
    const { rerender } = render(<PriceSummary quote={quote} />)
    const region = screen.getByRole('status')
    expect(region.textContent).toBe('')

    rerender(<PriceSummary quote={quote} stale staleMessage="Recalculando os valores." />)
    // Mesmo nó: o leitor de tela anuncia a mudança de conteúdo de uma região que já estava na página
    expect(screen.getByRole('status')).toBe(region)
    expect(region.textContent).toBe('Cotação desatualizada. Recalculando os valores.')

    rerender(<PriceSummary quote={quote} stale staleMessage="Os valores foram atualizados; confirme de novo." />)
    expect(region.textContent).toBe('Cotação desatualizada. Os valores foram atualizados; confirme de novo.')

    rerender(<PriceSummary quote={quote} />)
    expect(region.textContent).toBe('')
  })

  it('a ação de recotar continua acessível; o texto visível não é lido duas vezes', () => {
    render(
      <PriceSummary
        quote={quote}
        stale
        staleMessage="Não foi possível atualizar a cotação."
        staleAction={<button type="button">Tentar novamente</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy()
    expect(screen.getAllByText(/Não foi possível atualizar a cotação\./)).toHaveLength(2)
    expect(screen.getByText('Cotação desatualizada.').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('sem cotação (skeleton) não anuncia desatualizada', () => {
    render(<PriceSummary quote={undefined} stale />)
    expect(screen.getByRole('status').textContent).toBe('')
  })
})
