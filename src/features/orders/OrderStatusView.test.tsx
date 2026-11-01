// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Nft, Order, Wallet } from '@/contracts'
import { parseEth } from '@/lib/eth'

const applyOrderOutcome = vi.hoisted(() => vi.fn())
const nftFetch = vi.hoisted(() => vi.fn<(id: string) => Promise<Nft>>())
const walletsFetch = vi.hoisted(() => vi.fn<(accountId: string) => Promise<Wallet[]>>())

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className, ...rest }: { children: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock('./orderStatus', () => ({ applyOrderOutcome }))
vi.mock('@/features/checkout/checkoutDraft', () => ({ checkoutDraftStore: () => ({}) }))
vi.mock('@/api/nfts', () => ({
  nftDetailQuery: (id: string) => ({ queryKey: ['nft', id], queryFn: () => nftFetch(id) }),
}))
vi.mock('@/api/wallets', () => ({
  walletsQuery: (accountId: string) => ({ queryKey: ['wallets', accountId], queryFn: () => walletsFetch(accountId) }),
}))

const { OrderStatusView } = await import('./OrderStatusView')

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const item = { nftId: 'nft-002', name: 'Solar Veil', edition: '1/10' as const, quantity: 2, unitPrice: parseEth('0.35') }
const base: Order = {
  id: 'o1',
  status: 'pending',
  idempotencyKey: 'k1',
  quoteId: 'q1',
  walletId: 'w1',
  network: 'ethereum',
  items: [item],
  receipt: { items: [item], subtotal: parseEth('0.7'), discount: parseEth('0'), networkFee: parseEth('0.002'), total: parseEth('0.702') },
  createdAt: '2026-07-29T12:00:00.000Z',
  updatedAt: '2026-07-29T12:00:00.000Z',
}
const confirmed: Order = {
  ...base,
  status: 'confirmed',
  txHash: '0xabcdef0123456789abcdef0123456789abcdef01',
  explorerUrl: 'https://etherscan.io/tx/0xabc',
}

function renderView(order: Order) {
  nftFetch.mockResolvedValue({ id: 'nft-002', name: 'Solar Veil', images: [] } as unknown as Nft)
  walletsFetch.mockResolvedValue([{ id: 'w1', label: 'Carteira principal', address: '0x1' } as unknown as Wallet])
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const ui = (o: Order) => (
    <QueryClientProvider client={queryClient}>
      <OrderStatusView accountId="user-ana" order={o} />
    </QueryClientProvider>
  )
  const view = render(ui(order))
  return { rerender: (o: Order) => view.rerender(ui(o)) }
}

describe('OrderStatusView: título, recibo e ações por status', () => {
  it('pending: título de espera com foco, pedido e chave em evidência, sem recibo e sem buscar arte nem carteira', () => {
    renderView(base)
    const title = screen.getByRole('heading', { level: 1, name: 'Aguardando confirmação da rede' })
    expect(document.activeElement).toBe(title)
    expect(screen.getByText('Chave do pedido')).toBeTruthy()
    expect(screen.getByText('k1')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Detalhes da transação' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Voltar ao pagamento' })).toBeNull()
    expect(nftFetch).not.toHaveBeenCalled()
    expect(walletsFetch).not.toHaveBeenCalled()
  })

  it('declined: título de recusa, "Voltar ao pagamento" e nenhum recibo', () => {
    renderView({ ...base, status: 'declined' })
    expect(screen.getByRole('heading', { level: 1, name: 'Pagamento recusado' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voltar ao pagamento' }).getAttribute('href')).toBe('/checkout')
    expect(screen.queryByRole('heading', { name: 'Detalhes da transação' })).toBeNull()
    expect(nftFetch).not.toHaveBeenCalled()
    expect(walletsFetch).not.toHaveBeenCalled()
  })

  it('confirmed: título do "Thank you", recibo com a carteira e a chave discreta, sem "Voltar ao pagamento"', async () => {
    renderView(confirmed)
    expect(screen.getByRole('heading', { level: 1, name: 'Seus NFTs agora estão na sua carteira' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Detalhes da transação' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Voltar ao pagamento' })).toBeNull()
    expect(screen.queryByText('Chave do pedido')).toBeNull()
    expect(screen.getByText(/Chave/).textContent).toContain('k1')
    await waitFor(() => expect(screen.getByText('Carteira principal')).toBeTruthy())
    expect(nftFetch).toHaveBeenCalledWith('nft-002')
  })

  it('o X sempre volta ao Início e o desfecho é aplicado ao cache', () => {
    renderView(confirmed)
    expect(screen.getByRole('link', { name: 'Fechar e voltar ao Início' }).getAttribute('href')).toBe('/')
    expect(applyOrderOutcome).toHaveBeenCalledTimes(1)
  })

  it('o foco volta ao título quando o status muda', () => {
    const { rerender } = renderView(base)
    ;(document.activeElement as HTMLElement | null)?.blur()
    rerender({ ...base, status: 'declined' })
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Pagamento recusado' }))
  })
})
