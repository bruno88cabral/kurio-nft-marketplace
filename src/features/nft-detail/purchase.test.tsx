// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ApiError, type CartItem, type Nft } from '@/contracts'
import type { AddResult } from '@/features/cart/anonymousCart'
import { parseEth } from '@/lib/eth'

const add = vi.fn<(item: CartItem, opts: { available: number }) => Promise<AddResult>>()
const toastSuccess = vi.fn()
const toastError = vi.fn()
const navigate = vi.fn()
let cartState = { isPending: false, isAuthenticated: false }

vi.mock('@/features/cart/useCart', () => ({ useCart: () => ({ add, ...cartState }) }))
vi.mock('@/features/favorites/FavoriteButton', () => ({ NftFavoriteButton: () => null }))
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
}))

const { MobilePurchaseBar } = await import('./MobileDetailChrome')
const { PurchasePanel } = await import('./PurchasePanel')
const { usePurchaseSelection } = await import('./usePurchaseSelection')

const nft: Nft = {
  id: 'nft-023',
  name: 'Slate Vine',
  imageUrl: '/nfts/slate-vine.svg',
  images: ['/nfts/slate-vine.svg'],
  collection: 'Obsidian Garden',
  description: '',
  creator: 'x',
  network: 'ethereum',
  price: parseEth('0.5'),
  editions: [
    { kind: '1/10', available: 7, total: 10 },
    { kind: 'open', available: 120, total: 1000 },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  featured: false,
}

/** Como a rota: uma seleção, alimentando o painel (desktop) e a barra (mobile). */
function Detail() {
  const selection = usePurchaseSelection(nft, '1/10')
  return (
    <TooltipProvider>
      <PurchasePanel nft={nft} selection={selection} onEditionChange={() => undefined} />
      <MobilePurchaseBar nft={nft} selection={selection} />
    </TooltipProvider>
  )
}

// O painel (a partir de `md`) e a barra (mobile) têm cada um o seu stepper; o CSS mostra só um
const quantityInputs = () => screen.getAllByRole<HTMLInputElement>('textbox', { name: 'Quantidade' })
const increase = () => fireEvent.click(screen.getAllByRole('button', { name: 'Aumentar quantidade' })[0])
/** "COMPRAR" do painel (desktop). */
const buyPanel = () => screen.getByRole('button', { name: 'Comprar' })
/** "Comprar NFT" da barra mobile. */
const buyBar = () => screen.getByRole('button', { name: 'Comprar NFT' })
// "Adicionar ao carrinho" (só ícone): o do painel (a partir de `md`) vem antes do carrinho redondo da barra
const addButtons = () => screen.getAllByRole('button', { name: 'Adicionar ao carrinho' })
/** Carrinho (ícone) ao lado do COMPRAR, no painel. */
const addPanel = () => addButtons()[0]
/** Botão redondo do carrinho da barra mobile. */
const addBar = () => addButtons()[1]

beforeEach(() => {
  cartState = { isPending: false, isAuthenticated: false }
  add.mockReset()
  add.mockResolvedValue('added')
  toastSuccess.mockReset()
  toastError.mockReset()
  navigate.mockReset()
})
afterEach(cleanup)

describe('Adicionar ao carrinho (Detalhe)', () => {
  it('painel e barra mobile usam a mesma quantidade (os dois steppers mostram o mesmo valor)', async () => {
    render(<Detail />)
    increase()
    increase()
    expect(quantityInputs().map((i) => i.value)).toEqual(['3', '3'])

    for (const [button, calls] of [[addBar, 1], [buyBar, 2], [buyPanel, 3], [addPanel, 4]] as const) {
      fireEvent.click(button())
      await waitFor(() => expect(add).toHaveBeenCalledTimes(calls))
      expect(add).toHaveBeenLastCalledWith({ nftId: 'nft-023', edition: '1/10', quantity: 3 }, { available: 7 })
    }
  })

  it('"Comprar" (painel) e "Comprar NFT" (barra) adicionam e levam ao carrinho, sem o toast', async () => {
    render(<Detail />)
    fireEvent.click(buyPanel())
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/cart' }))
    navigate.mockReset()
    fireEvent.click(buyBar())
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/cart' }))
    expect(add).toHaveBeenCalledTimes(2)
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('"Comprar" com erro de estoque não sai do Detalhe', async () => {
    add.mockRejectedValue(new ApiError({ code: 'conflict', message: 'Só restam 7 unidade(s).' }, 409))
    render(<Detail />)
    fireEvent.click(buyPanel())
    await screen.findByRole('alert')
    fireEvent.click(buyBar())
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Só restam 7 unidade(s).'))
    expect(navigate).not.toHaveBeenCalled()
  })

  it('o carrinho do painel (só ícone, ao lado do COMPRAR) adiciona sem sair, com o toast; o 409 também vira toast', async () => {
    render(<Detail />)
    expect(addButtons()).toHaveLength(2)
    fireEvent.click(addPanel())
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Adicionado ao carrinho', expect.anything()))
    expect(navigate).not.toHaveBeenCalled()

    add.mockRejectedValue(new ApiError({ code: 'conflict', message: 'Só restam 7 unidade(s).' }, 409))
    fireEvent.click(addPanel())
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Só restam 7 unidade(s).'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('o carrinho da barra mostra o toast com a ação "Ver carrinho" que leva a /cart', async () => {
    render(<Detail />)
    fireEvent.click(addBar())
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())
    const [message, options] = toastSuccess.mock.calls[0] as [string, { action: { label: string; onClick: () => void } }]
    expect(message).toBe('Adicionado ao carrinho')
    expect(options.action.label).toBe('Ver carrinho')
    options.action.onClick()
    expect(navigate).toHaveBeenCalledWith({ to: '/cart' })
  })

  it('409 no painel vira mensagem role=alert com o texto da API', async () => {
    add.mockRejectedValue(new ApiError({ code: 'conflict', message: 'Só restam 7 unidade(s) de Slate Vine (1/10).' }, 409))
    render(<Detail />)
    fireEvent.click(buyPanel())
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Só restam 7 unidade(s)')
    expect(toastError).not.toHaveBeenCalled()
    // Mudar a quantidade invalida o aviso
    increase()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('409 no carrinho da barra mobile vira toast', async () => {
    add.mockRejectedValue(new ApiError({ code: 'conflict', message: 'Só restam 7 unidade(s).' }, 409))
    render(<Detail />)
    fireEvent.click(addBar())
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Só restam 7 unidade(s).'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('visitante já no limite (nada coube): aviso no painel no padrão do 409, sem "Adicionado ao carrinho"', async () => {
    add.mockResolvedValue('unchanged')
    render(<Detail />)
    fireEvent.click(buyPanel())
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Só restam 7 unidades desta edição, e todas já estão no seu carrinho.')
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it('visitante já no limite na barra mobile: toast de erro, sem "Adicionado ao carrinho"', async () => {
    add.mockResolvedValue('unchanged')
    render(<Detail />)
    fireEvent.click(addBar())
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Só restam 7 unidades desta edição, e todas já estão no seu carrinho.'))
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('visitante com só parte da quantidade cabendo: aviso no painel com o que ficou no carrinho, sem "Adicionado ao carrinho"', async () => {
    add.mockResolvedValue('partial')
    render(<Detail />)
    fireEvent.click(buyPanel())
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Só restam 7 unidades desta edição: seu carrinho ficou com 7.')
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it('visitante com só parte cabendo na barra mobile: toast de erro, sem "Adicionado ao carrinho"', async () => {
    add.mockResolvedValue('partial')
    render(<Detail />)
    fireEvent.click(addBar())
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Só restam 7 unidades desta edição: seu carrinho ficou com 7.'))
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('outro erro vira toast genérico', async () => {
    add.mockRejectedValue(new Error('rede'))
    render(<Detail />)
    fireEvent.click(buyPanel())
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Não foi possível adicionar ao carrinho.'))
  })

  it('enquanto envia fica aria-busy e ignora o segundo clique', async () => {
    let resolve: () => void = () => undefined
    add.mockImplementation(() => new Promise<AddResult>((r) => (resolve = () => r('added'))))
    render(<Detail />)
    const desktop = buyPanel()
    fireEvent.click(desktop)
    fireEvent.click(desktop)
    expect(desktop.getAttribute('aria-busy')).toBe('true')
    expect(add).toHaveBeenCalledTimes(1)
    resolve()
    await waitFor(() => expect(desktop.getAttribute('aria-busy')).toBeNull())
  })

  it('com a sessão sendo confirmada não adiciona (iria para o carrinho de visitante)', () => {
    cartState = { isPending: true, isAuthenticated: false }
    render(<Detail />)
    const desktop = buyPanel()
    expect(desktop.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(desktop)
    expect(add).not.toHaveBeenCalled()
  })
})
