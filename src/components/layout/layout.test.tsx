// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { parseEth } from '@/lib/eth'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a href="/" className={className}>
      {children}
    </a>
  ),
}))

const { SiteFooter } = await import('./SiteFooter')
const { NftCard } = await import('@/components/kurio/NftCard')

afterEach(cleanup)

describe('SiteFooter (Figma)', () => {
  const renderFooter = () =>
    render(
      <TooltipProvider>
        <SiteFooter />
      </TooltipProvider>,
    )

  it('tem os 3 benefícios, a faixa de contato e as colunas com os itens do Figma', () => {
    renderFooter()
    for (const title of ['Segurança da carteira', 'Criadores em destaque', 'Alertas de lançamentos']) {
      expect(screen.getByRole('heading', { name: title })).toBeTruthy()
    }
    expect(screen.getByText('Feito para colecionadores, criadores e cultura')).toBeTruthy()
    const perfil = screen.getByRole('region', { name: 'Meu perfil' })
    expect(within(perfil).getAllByRole('button').map((b) => b.textContent?.replace(' (em breve)', ''))).toEqual([
      'Meu perfil',
      'Minha coleção',
      'Atividade',
      'Estúdio do criador',
      'Lista de interesse',
    ])
    expect(screen.getByText('METAMASK · WALLETCONNECT · COINBASE')).toBeTruthy()
    expect(screen.getByText('© 2026 Kurio. Propriedade digital para todos.')).toBeTruthy()
  })

  it('redes sociais são ícones com nome acessível, e toda ação do footer é "Em breve"', () => {
    renderFooter()
    for (const name of ['Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'YouTube']) {
      expect(screen.getByRole('button', { name: `${name} (em breve)` })).toBeTruthy()
    }
    const footer = screen.getByRole('contentinfo')
    for (const button of within(footer).getAllByRole('button')) {
      expect(button.getAttribute('aria-disabled')).toBe('true')
    }
  })
})

describe('NftCard (Figma)', () => {
  const nft = {
    id: 'nft-001',
    name: 'Emerald Ape #042',
    imageUrl: '/nfts/emerald-ape.svg',
    price: parseEth('1.99'),
    editions: [{ kind: '1/50' as const, available: 3, total: 50 }],
    collection: 'Kurio Apes',
  }

  it('não mostra a coleção (sem eyebrow) e o preço anterior fica ao lado, sem riscado', () => {
    render(<NftCard nft={nft} previousPrice={parseEth('2.29')} />)
    expect(screen.queryByText('Kurio Apes')).toBeNull()
    const previous = screen.getByText('2.29 ETH', { exact: false })
    expect(previous.closest('s')).toBeNull()
    expect(previous.textContent).toContain('Preço anterior:')
  })
})
