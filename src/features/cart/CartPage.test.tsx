// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type Cart, type Nft, type Quote } from '@/contracts'
import { parseEth } from '@/lib/eth'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }))
const ANA = vi.hoisted(() => ({ id: 'user-ana', email: 'ana@kurio.test', name: 'Ana Souza' }))
vi.mock('@/api/client', () => ({ apiClient: api }))
vi.mock('@/auth/useSession', () => ({ useSession: () => ({ account: ANA, isAuthenticated: true, isPending: false }) }))
vi.mock('@/auth/sessionGuard', () => ({ captureSession: () => () => true }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}))

const { CartPage } = await import('./CartPage')

const ITEM = { nftId: 'nft-002', edition: '1/10' as const, quantity: 1 }
const NFT: Nft = {
  id: 'nft-002',
  name: 'Solar Veil',
  imageUrl: '/nfts/solar-veil.svg',
  images: ['/nfts/solar-veil.svg'],
  collection: 'x',
  description: '',
  creator: 'x',
  network: 'ethereum',
  price: parseEth('0.35'),
  editions: [{ kind: '1/10', available: 5, total: 10 }],
  createdAt: '2026-01-01T00:00:00.000Z',
  featured: false,
}
const quote = (unavailable = false): Quote => ({
  quoteId: 'q1',
  items: [{ ...ITEM, unitPrice: parseEth('0.35') }],
  subtotal: parseEth('0.35'),
  discount: parseEth('0'),
  networkFee: parseEth('0.002'),
  total: parseEth('0.352'),
  ...(unavailable ? { issues: [{ ...ITEM, kind: 'unavailable' as const }] } : {}),
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
})

let postQuote: () => Promise<{ data: Quote }>

beforeEach(() => {
  postQuote = () => new Promise(() => undefined)
  api.get.mockImplementation((url: string) => {
    if (url === '/cart') return Promise.resolve({ data: { items: [ITEM] } satisfies Cart })
    if (url.startsWith('/nfts/')) return Promise.resolve({ data: NFT })
    return Promise.reject(new Error(`GET ${url} sem mock`))
  })
  api.post.mockImplementation((url: string) => (url === '/quotes' ? postQuote() : Promise.reject(new Error(url))))
})
afterEach(() => {
  cleanup()
  Object.values(api).forEach((fn) => fn.mockReset())
})

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CartPage />
    </QueryClientProvider>,
  )
}

const blockedCta = () => screen.getByRole('button', { name: 'Ir para o pagamento' })
const describedBy = (element: HTMLElement) => document.getElementById(element.getAttribute('aria-describedby') ?? '')?.textContent

describe('CartPage: "Ir para o pagamento" bloqueado diz o motivo', () => {
  it('sem cotação ainda: "Calculando o total…"', async () => {
    renderPage()
    await screen.findByText('Solar Veil')
    expect(blockedCta().getAttribute('aria-disabled')).toBe('true')
    expect(describedBy(blockedCta())).toBe('Calculando o total…')
  })

  it('erro de cotação: o motivo diz que o total não foi calculado', async () => {
    postQuote = () => Promise.reject(new ApiError({ code: 'transient', message: 'x' }))
    renderPage()
    await waitFor(() => expect(describedBy(blockedCta())).toBe('Não foi possível calcular o total. Tente novamente para continuar.'))
  })

  it('itens indisponíveis: aponta para o próprio alerta', async () => {
    postQuote = () => Promise.resolve({ data: quote(true) })
    renderPage()
    const alert = await screen.findByRole('alert')
    expect(blockedCta().getAttribute('aria-describedby')).toBe(alert.id)
  })

  it('cotação atual: vira link, sem motivo', async () => {
    postQuote = () => Promise.resolve({ data: quote() })
    renderPage()
    const link = await screen.findByRole('link', { name: 'Ir para o pagamento' })
    expect(link.getAttribute('aria-describedby')).toBeNull()
  })
})
