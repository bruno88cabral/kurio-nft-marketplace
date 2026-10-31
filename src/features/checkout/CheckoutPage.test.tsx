// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { quoteQuery } from '@/api/quotes'
import { ApiError, type Cart, type Nft, type Order, type Quote, type Wallet } from '@/contracts'
import { parseEth } from '@/lib/eth'
import { attemptSnapshotOf } from './attemptSnapshot'
import type { CheckoutDraft } from './checkoutDraft'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }))
const navigate = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const toastError = vi.hoisted(() => vi.fn())
const ANA = vi.hoisted(() => ({ id: 'user-ana', email: 'ana@kurio.test', name: 'Ana Souza' }))

vi.mock('@/api/client', () => ({ apiClient: api }))
vi.mock('@/auth/useSession', () => ({ useSession: () => ({ account: ANA, isAuthenticated: true, isPending: false }) }))
vi.mock('@/auth/sessionGuard', () => ({ captureSession: () => () => true }))
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  Navigate: ({ to }: { to: string }) => <p data-testid="navigate">{to}</p>,
  useNavigate: () => navigate,
}))

const { CheckoutPage, ATTEMPT_CONFLICT_MESSAGE } = await import('./CheckoutPage')
const { checkoutDraftStore } = await import('./checkoutDraft')
const { ATTEMPT_REVIEW_MESSAGE } = await import('./reviewSource')

const ITEM = { nftId: 'nft-002', edition: '1/10' as const, quantity: 1 }
const WALLET: Wallet = { id: 'wallet-ana-1', address: '0x' + '1'.repeat(40), network: 'ethereum', role: 'primary', label: 'Principal' }
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
const quoteOf = (quoteId: string, price = '0.35'): Quote => ({
  quoteId,
  items: [{ ...ITEM, unitPrice: parseEth(price) }],
  subtotal: parseEth(price),
  discount: parseEth('0'),
  networkFee: parseEth('0.002'),
  total: parseEth(price),
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
})
const orderOf = (quoteId: string, key: string): Order => ({
  id: 'o1',
  status: 'pending',
  idempotencyKey: key,
  quoteId,
  walletId: WALLET.id,
  network: 'ethereum',
  items: [{ ...ITEM, name: 'Solar Veil', unitPrice: parseEth('0.35') }],
  receipt: { items: [], subtotal: parseEth('0'), discount: parseEth('0'), networkFee: parseEth('0'), total: parseEth('0') },
  createdAt: '2026-10-31T12:00:00.000Z',
  updatedAt: '2026-10-31T12:00:00.000Z',
})

/** Respostas da API por rota. `quotes` sai em ordem; `orders` é o `POST /orders` (padrão: pendente para sempre). */
let cart: Cart
let quotes: Quote[]
let postOrder: (body: unknown, key: string) => Promise<{ data: Order }>
const orderCalls = () => api.post.mock.calls.filter(([url]) => url === '/orders')

beforeEach(() => {
  sessionStorage.clear()
  checkoutDraftStore(ANA.id).clear()
  cart = { items: [ITEM] }
  quotes = [quoteOf('q1')]
  postOrder = () => new Promise(() => undefined)
  api.get.mockImplementation((url: string) => {
    if (url === '/cart') return Promise.resolve({ data: cart })
    if (url === '/profile') return Promise.resolve({ data: { displayName: 'Ana Souza', wallets: [WALLET] } })
    if (url === '/wallets') return Promise.resolve({ data: [WALLET] })
    if (url.startsWith('/nfts/')) return Promise.resolve({ data: NFT })
    return Promise.reject(new Error(`GET ${url} sem mock`))
  })
  api.post.mockImplementation((url: string, body: unknown, config?: { headers?: Record<string, string> }) => {
    if (url === '/quotes') return Promise.resolve({ data: quotes.length > 1 ? quotes.shift() : quotes[0] })
    if (url === `/wallets/${WALLET.id}/connect`) return Promise.resolve({ data: WALLET })
    if (url === '/orders') return postOrder(body, config?.headers?.['Idempotency-Key'] ?? '')
    return Promise.reject(new Error(`POST ${url} sem mock`))
  })
})
afterEach(() => {
  cleanup()
  Object.values(api).forEach((fn) => fn.mockReset())
  navigate.mockClear()
  toastError.mockReset()
})

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CheckoutPage />
    </QueryClientProvider>,
  )
  return queryClient
}

const confirmButton = () => screen.getByRole('button', { name: /Confirmar compra|Confirmando…/ })
const describedText = (element: HTMLElement) =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent)

async function connectAndWaitForConfirm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Conectar' }))
  await screen.findByText('Principal conectada.')
  await waitFor(() => expect(confirmButton().getAttribute('aria-disabled')).toBeNull())
}

describe('CheckoutPage', () => {
  it('"Confirmar compra" bloqueado diz o motivo por aria-describedby e o perde ao habilitar', async () => {
    renderPage()
    await screen.findByText('Solar Veil')
    await screen.findByRole('button', { name: 'Conectar' })
    expect(confirmButton().getAttribute('aria-disabled')).toBe('true')
    expect(describedText(confirmButton())).toEqual(['Conecte uma carteira para confirmar.'])
    await connectAndWaitForConfirm()
    expect(confirmButton().getAttribute('aria-describedby')).toBeNull()
  })

  it('duplo clique em "Confirmar compra" envia um único POST /orders (trava com useRef)', async () => {
    renderPage()
    await connectAndWaitForConfirm()
    const button = confirmButton()
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(orderCalls()).toHaveLength(1))
    expect(button.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(button)
    await new Promise((r) => setTimeout(r, 20))
    expect(orderCalls()).toHaveLength(1)
  })

  it('falha transitória troca o CTA por "Tentar de novo", com o foco nele, e reenvia a mesma chave e o mesmo corpo', async () => {
    postOrder = () => Promise.reject(new ApiError({ code: 'transient', message: 'timeout of 10000ms exceeded' }))
    renderPage()
    await connectAndWaitForConfirm()
    fireEvent.click(confirmButton())
    const retry = await screen.findByRole('button', { name: 'Tentar de novo' })
    expect(document.activeElement).toBe(retry)
    expect(screen.queryByRole('button', { name: /Confirmar compra/ })).toBeNull()
    expect(screen.getByText('Não confirmamos o envio.')).toBeTruthy()
    // A Revisão passa a mostrar a tentativa
    expect(screen.getByText(ATTEMPT_REVIEW_MESSAGE)).toBeTruthy()

    postOrder = (_body, key) => Promise.resolve({ data: orderOf('q1', key) })
    fireEvent.click(retry)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/orders/$orderId', params: { orderId: 'o1' } })))
    const [first, second] = orderCalls()
    expect(second?.[1]).toEqual(first?.[1])
    expect(second?.[2]).toEqual(first?.[2])
  })

  it('tentativa pendente sem conexão (depois do logout): carteira travada e sem "Conectar"', async () => {
    const draft: CheckoutDraft = {
      walletId: WALLET.id,
      idempotencyKey: 'k1',
      keyFingerprint: `q0:${WALLET.id}`,
      attempt: { quoteId: 'q0', walletId: WALLET.id },
      attemptSnapshot: attemptSnapshotOf(quoteOf('q0')),
    }
    checkoutDraftStore(ANA.id).set(draft)
    renderPage()
    await screen.findByRole('button', { name: 'Tentar de novo' })
    await screen.findByText('A carteira fica fixa até o pedido anterior ser resolvido.')
    expect(screen.queryByRole('button', { name: 'Conectar' })).toBeNull()
  })

  it('a tentativa no mount esconde a cotação do carrinho: o revisado é o que a tela mostrou depois que ela sai', async () => {
    // A tentativa (q0) está na Revisão; a cotação do carrinho (q1 a 0.35) carrega sem aparecer
    const draft: CheckoutDraft = {
      walletId: WALLET.id,
      connectedWalletId: WALLET.id,
      idempotencyKey: 'k1',
      keyFingerprint: `q0:${WALLET.id}`,
      attempt: { quoteId: 'q0', walletId: WALLET.id },
      attemptSnapshot: attemptSnapshotOf(quoteOf('q0')),
    }
    const drafts = checkoutDraftStore(ANA.id)
    drafts.set(draft)
    const queryClient = renderPage()
    await screen.findByRole('button', { name: 'Tentar de novo' })
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/quotes', undefined, expect.anything()))

    // Em segundo plano o preço muda (q2 a 0.5), ainda escondido pela tentativa
    quotes = [quoteOf('q2', '0.5')]
    await act(() => queryClient.refetchQueries({ queryKey: quoteQuery(ANA.id, cart).queryKey }))

    // A tentativa sai (ex.: `declined`): a Revisão volta ao carrinho e mostra q2
    act(() => drafts.set({ walletId: WALLET.id, connectedWalletId: WALLET.id }))
    await waitFor(() => expect(confirmButton().getAttribute('aria-disabled')).toBeNull())
    expect(screen.getAllByText('0.5 ETH').length).toBeGreaterThan(0)

    // Confirmar compara com q2 (exibida), não com q1 (nunca exibida): nada mudou e o pedido sai
    postOrder = (_body, key) => Promise.resolve({ data: orderOf('q2', key) })
    fireEvent.click(confirmButton())
    await waitFor(() => expect(orderCalls()).toHaveLength(1))
    expect(screen.queryByText(/Os valores mudaram/)).toBeNull()
  })
})

describe('CheckoutPage com o carrinho vazio e tentativa pendente', () => {
  const pendingDraft = (): CheckoutDraft => ({
    walletId: WALLET.id,
    idempotencyKey: 'k1',
    keyFingerprint: `q0:${WALLET.id}`,
    attempt: { quoteId: 'q0', walletId: WALLET.id },
    attemptSnapshot: attemptSnapshotOf(quoteOf('q0')),
  })

  beforeEach(() => {
    cart = { items: [] }
  })

  it('mostra o que "Tentar de novo" compra (itens e total da tentativa) acima do aviso', async () => {
    checkoutDraftStore(ANA.id).set(pendingDraft())
    renderPage()
    const retry = await screen.findByRole('button', { name: 'Tentar de novo' })
    expect(screen.getByText(ATTEMPT_REVIEW_MESSAGE)).toBeTruthy()
    expect(await screen.findByText('Solar Veil')).toBeTruthy()
    expect(screen.getByText('Total')).toBeTruthy()
    // A lista vem antes do aviso no documento
    expect(screen.getByText('Solar Veil').compareDocumentPosition(retry) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByTestId('navigate')).toBeNull()
  })

  it('409 no "Tentar de novo" avisa por toast antes de voltar ao /cart', async () => {
    checkoutDraftStore(ANA.id).set(pendingDraft())
    postOrder = () =>
      Promise.reject(new ApiError({ code: 'conflict', message: 'Esta cotação já foi usada em outro pedido.' }, 409))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(ATTEMPT_CONFLICT_MESSAGE, { description: 'Esta cotação já foi usada em outro pedido.' }),
    )
    expect((await screen.findByTestId('navigate')).textContent).toBe('/cart')
    expect(orderCalls()[0]?.[2]).toEqual({ headers: { 'Idempotency-Key': 'k1' } })
  })
})
