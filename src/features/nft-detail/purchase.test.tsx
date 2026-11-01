// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ApiError, type CartItem, type Nft } from '@/contracts'
import { parseEth } from '@/lib/eth'

const add = vi.fn<(item: CartItem, opts: { available: number }) => Promise<boolean>>()
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

const quantityInputs = () => screen.getAllByRole<HTMLInputElement>('textbox', { name: 'Quantidade' })
const addButtons = () => screen.getAllByRole('button', { name: 'Adicionar ao carrinho' })

beforeEach(() => {
  cartState = { isPending: false, isAuthenticated: false }
  add.mockReset()
  add.mockResolvedValue(true)
  toastSuccess.mockReset()
  toastError.mockReset()
  navigate.mockReset()
})
afterEach(cleanup)

describe('Adicionar ao carrinho (Detalhe)', () => {
  it('desktop e barra mobile adicionam a quantidade escolhida no painel', async () => {
    render(<Detail />)
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' }))
    expect(quantityInputs().map((i) => i.value)).toEqual(['3'])

    const [desktop, mobile] = addButtons()
    fireEvent.click(mobile)
    await waitFor(() => expect(add).toHaveBeenCalledTimes(1))
    expect(add).toHaveBeenLastCalledWith({ nftId: 'nft-023', edition: '1/10', quantity: 3 }, { available: 7 })

    fireEvent.click(desktop)
    await waitFor(() => expect(add).toHaveBeenCalledTimes(2))
    expect(add).toHaveBeenLastCalledWith({ nftId: 'nft-023', edition: '1/10', quantity: 3 }, { available: 7 })
  })

  it('sucesso mostra o toast com a ação "Ver carrinho" que leva a /cart', async () => {
    render(<Detail />)
    fireEvent.click(addButtons()[1])
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
    fireEvent.click(addButtons()[0])
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Só restam 7 unidade(s)')
    expect(toastError).not.toHaveBeenCalled()
    // Mudar a quantidade invalida o aviso
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('409 na barra mobile vira toast', async () => {
    add.mockRejectedValue(new ApiError({ code: 'conflict', message: 'Só restam 7 unidade(s).' }, 409))
    render(<Detail />)
    fireEvent.click(addButtons()[1])
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Só restam 7 unidade(s).'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('visitante já no limite (nada coube): aviso no painel no padrão do 409, sem "Adicionado ao carrinho"', async () => {
    add.mockResolvedValue(false)
    render(<Detail />)
    fireEvent.click(addButtons()[0])
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Só restam 7 unidades desta edição, e todas já estão no seu carrinho.')
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
  })

  it('visitante já no limite na barra mobile: toast de erro, sem "Adicionado ao carrinho"', async () => {
    add.mockResolvedValue(false)
    render(<Detail />)
    fireEvent.click(addButtons()[1])
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Só restam 7 unidades desta edição, e todas já estão no seu carrinho.'))
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('outro erro vira toast genérico', async () => {
    add.mockRejectedValue(new Error('rede'))
    render(<Detail />)
    fireEvent.click(addButtons()[0])
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Não foi possível adicionar ao carrinho.'))
  })

  it('enquanto envia fica aria-busy e ignora o segundo clique', async () => {
    let resolve: () => void = () => undefined
    add.mockImplementation(() => new Promise<boolean>((r) => (resolve = () => r(true))))
    render(<Detail />)
    const [desktop] = addButtons()
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
    const [desktop] = addButtons()
    expect(desktop.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(desktop)
    expect(add).not.toHaveBeenCalled()
  })
})
