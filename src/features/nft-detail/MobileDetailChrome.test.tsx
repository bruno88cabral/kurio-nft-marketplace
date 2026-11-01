// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NftEdition } from '@/contracts'
import { parseEth } from '@/lib/eth'
import { renderWithProviders } from '@/test/render'
import { historyBackSpy, navigateSpy, setCanGoBack } from '@/test/routerMock'
import { MobileBackButton, MobileDetailTopBar, MobilePurchaseBar } from './MobileDetailChrome'
import type { PurchaseSelection } from './usePurchaseSelection'

const addToCart = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
vi.mock('@/features/cart/AddToCartButton', () => ({
  AddToCartButton: (props: { item: unknown; available: number; label?: string; intent?: string; iconOnly?: boolean }) => {
    addToCart(props)
    return <button type="button">{props.label ?? 'Adicionar ao carrinho'}</button>
  },
}))
vi.mock('@/features/favorites/FavoriteButton', () => ({
  NftFavoriteButton: ({ nft, variant }: { nft: { name: string }; variant?: string }) => (
    <button type="button" data-variant={variant}>{`Favoritar ${nft.name}`}</button>
  ),
}))

const EDITION: NftEdition = { kind: '1/10', available: 7, total: 10 }
const nft = { id: 'nft-9', price: parseEth('0.5') }
const selection = (over: Partial<PurchaseSelection> = {}): PurchaseSelection => ({
  edition: EDITION,
  unavailable: false,
  quantity: 3,
  setQuantity: vi.fn(),
  soldOut: false,
  ...over,
})

describe('MobileDetailTopBar', () => {
  it('voltar à esquerda e o favorito redondo à direita', () => {
    renderWithProviders(<MobileDetailTopBar nft={{ id: 'nft-9', name: 'Obra X' }} className="x" />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent || b.getAttribute('aria-label'))).toEqual(['Voltar', 'Favoritar Obra X'])
    expect(buttons[1]?.getAttribute('data-variant')).toBe('round')
  })
})

describe('MobileBackButton', () => {
  it('voltar usa o histórico quando há para onde voltar', () => {
    setCanGoBack(true)
    renderWithProviders(<MobileBackButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(historyBackSpy).toHaveBeenCalledOnce()
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('num acesso direto (sem histórico) voltar vai para o Início', () => {
    setCanGoBack(false)
    renderWithProviders(<MobileBackButton className="x" />)
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/' })
    expect(historyBackSpy).not.toHaveBeenCalled()
  })
})

describe('MobilePurchaseBar', () => {
  it('"Comprar NFT" e o carrinho redondo recebem a seleção (edição, quantidade e disponível)', () => {
    addToCart.mockClear()
    renderWithProviders(<MobilePurchaseBar nft={nft} selection={selection()} className="x" />)
    const item = { nftId: 'nft-9', edition: '1/10', quantity: 3 }
    expect(addToCart).toHaveBeenCalledWith(expect.objectContaining({ intent: 'buy', label: 'Comprar NFT', item, available: 7 }))
    expect(addToCart).toHaveBeenCalledWith(expect.objectContaining({ iconOnly: true, item, available: 7 }))
    expect(screen.getByRole('button', { name: 'Comprar NFT' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeTruthy()
  })

  it('esgotado: botão "Esgotado" desabilitado', () => {
    renderWithProviders(<MobilePurchaseBar nft={nft} selection={selection({ soldOut: true, edition: undefined })} />)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Esgotado' }).disabled).toBe(true)
  })

  it('sem edição efetiva (e não esgotado) não mostra ação de compra', () => {
    addToCart.mockClear()
    renderWithProviders(<MobilePurchaseBar nft={nft} selection={selection({ edition: undefined })} />)
    expect(addToCart).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Comprar|carrinho|Esgotado/ })).toBeNull()
  })
})
