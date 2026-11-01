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
const { NftCard, NftCardSkeleton } = await import('@/components/kurio/NftCard')
const { PriceTag } = await import('@/components/kurio/PriceTag')

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

describe('PriceTag: tone', () => {
  const priceSpan = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[data-slot="price-tag"] > span')!

  it('`neutral` é o padrão (branco); `accent` deixa o preço laranja e em negrito', () => {
    const neutral = render(<PriceTag price={parseEth('1.19')} />)
    expect(priceSpan(neutral.container).className).toContain('text-foreground')
    expect(priceSpan(neutral.container).className).not.toContain('text-text-accent')
    neutral.unmount()

    const accent = render(<PriceTag price={parseEth('1.19')} tone="accent" />)
    expect(priceSpan(accent.container).className).toContain('text-text-accent')
    expect(priceSpan(accent.container).className).toContain('font-bold')
  })

  it('com `accent`, o preço "alterado" continua visualmente distinto do normal', () => {
    const normal = render(<PriceTag price={parseEth('0.24')} tone="accent" />)
    const normalClass = priceSpan(normal.container).className
    normal.unmount()
    const changed = render(
      <PriceTag price={parseEth('0.24')} previousPrice={parseEth('0.22')} tone="accent" changed />,
    )
    const changedClass = priceSpan(changed.container).className
    expect(changedClass).not.toBe(normalClass)
    expect(changedClass).toContain('bg-primary/15')
  })
})

describe('NftCardSkeleton: mesma caixa do card (CLS)', () => {
  const nft = {
    id: 'nft-001',
    name: 'Emerald Ape #042',
    imageUrl: '/nfts/emerald-ape.svg',
    price: parseEth('1.19'),
    editions: [{ kind: '1/50' as const, available: 3, total: 50 }],
  }
  const gaps = (el: Element) => [...el.classList].filter((c) => c.startsWith('gap-'))
  // Classes que só pintam (cor, hover, transição); o resto do bloco é dimensão (padding, raio)
  const isPaint = (c: string) => c.startsWith('bg-') || c.startsWith('group-hover') || c.startsWith('transition')

  it.each([
    ['grid', 'text-body-lg', 'h-6'],
    ['carousel', 'text-caption', 'h-4.5'],
  ] as const)('%s: mesmo bloco da arte, mesmo gap e uma linha por texto com a altura da fonte', (size, font, line) => {
    const card = render(<NftCard nft={nft} size={size} />)
    const link = card.container.querySelector('[data-slot="nft-card"] > a')!
    const [cardBlock, cardText] = [...link.children]
    expect(cardText.querySelector('h3')!.classList).toContain(font)
    expect(cardText.querySelector('[data-slot="price-tag"]')!.classList).toContain(font)
    const cardGaps = gaps(link)
    const blockDims = [...cardBlock.classList].filter((c) => !isPaint(c))
    const art = cardBlock.children[0].classList
    expect(art).toContain('aspect-square')
    expect(art).toContain('rounded-xl')
    card.unmount()

    const sk = render(<NftCardSkeleton size={size} />)
    const root = sk.container.querySelector('[data-slot="nft-card-skeleton"]')!
    const [skBlock, skText] = [...root.children]
    expect(gaps(root)).toEqual(cardGaps)
    expect([...skBlock.classList].filter((c) => !isPaint(c))).toEqual(blockDims)
    expect(skBlock.children[0].classList).toContain('aspect-square')
    expect(skBlock.children[0].classList).toContain('rounded-xl')
    // Duas linhas (nome e preço), cada uma com a altura de linha da fonte do card
    const lines = [...skText.children]
    expect(lines).toHaveLength(2)
    for (const l of lines) expect(l.classList).toContain(line)
  })
})
