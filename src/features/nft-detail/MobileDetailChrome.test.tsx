// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NftEdition } from '@/contracts'
import { parseEth } from '@/lib/eth'
import { renderWithProviders } from '@/test/render'
import { historyBackSpy, navigateSpy, setCanGoBack } from '@/test/routerMock'
import { MobilePurchaseBar, MobileScreenHeader } from './MobileDetailChrome'
import type { PurchaseSelection } from './usePurchaseSelection'

const addToCart = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
vi.mock('@/features/cart/AddToCartButton', () => ({
  AddToCartButton: (props: { item: unknown; available: number }) => {
    addToCart(props)
    return <button type="button">Adicionar ao carrinho</button>
  },
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

describe('MobileScreenHeader', () => {
  it('mostra o título e voltar usa o histórico quando há para onde voltar', () => {
    setCanGoBack(true)
    renderWithProviders(<MobileScreenHeader title="Obra X" />)
    expect(screen.getByText('Obra X')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(historyBackSpy).toHaveBeenCalledOnce()
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('num acesso direto (sem histórico) voltar vai para o Início', () => {
    setCanGoBack(false)
    renderWithProviders(<MobileScreenHeader title="Obra X" className="x" />)
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(navigateSpy).toHaveBeenCalledWith({ to: '/' })
    expect(historyBackSpy).not.toHaveBeenCalled()
  })
})

describe('MobilePurchaseBar', () => {
  it('chama AddToCartButton com a seleção (edição, quantidade e disponível)', () => {
    renderWithProviders(<MobilePurchaseBar nft={nft} selection={selection()} className="x" />)
    expect(addToCart).toHaveBeenLastCalledWith({ item: { nftId: 'nft-9', edition: '1/10', quantity: 3 }, available: 7 })
    expect(screen.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeTruthy()
  })

  it('esgotado: botão "Esgotado" desabilitado', () => {
    renderWithProviders(<MobilePurchaseBar nft={nft} selection={selection({ soldOut: true, edition: undefined })} />)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Esgotado' }).disabled).toBe(true)
  })

  it('sem edição efetiva (e não esgotado) não mostra ação', () => {
    renderWithProviders(<MobilePurchaseBar nft={nft} selection={selection({ edition: undefined })} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
