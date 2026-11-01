// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

const { CheckoutPage, ATTEMPT_CONFLICT_MESSAGE, ORDER_IN_PROGRESS_MESSAGE, ORDER_LOAD_FAILED_MESSAGE } = await import('./CheckoutPage')
const { ATTEMPT_SENT_TITLE } = await import('./PendingAttempt')
const { checkoutDraftStore } = await import('./checkoutDraft')
const { ATTEMPT_REVIEW_MESSAGE } = await import('./reviewSource')
const { REVIEW_DIALOG_TITLE, REVIEW_VALUES_CHANGED_MESSAGE } = await import('./ReviewDialog')
const { VALUES_CHANGED_MESSAGE } = await import('./placeOrder')
const { ONLY_PRIMARY_MESSAGE } = await import('./CollectorFormSection')
const { COLLECTOR_MESSAGES } = await import('./collectorForm')

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

/** Escolhe o provedor em "Carteira e rede" (o "Conectar com …" só aparece com um provedor). */
async function chooseProvider(name = 'MetaMask') {
  fireEvent.click(await screen.findByRole('radio', { name }))
  return screen.findByRole('button', { name: `Conectar com ${name}` })
}

async function connectAndWaitForConfirm() {
  fireEvent.click(await chooseProvider())
  await screen.findByText('Principal conectada com MetaMask.')
  await waitFor(() => expect(confirmButton().getAttribute('aria-disabled')).toBeNull())
}

/** O campo do "Perfil do colecionador" pelo rótulo (o asterisco decorativo faz parte do texto do <label>). */
const collectorField = (label: string) => screen.getByLabelText<HTMLInputElement>(new RegExp(`^${label}`))

const VALID_COLLECTOR = {
  'Nome de usuário': 'ana_souza',
  'Nome do perfil': 'Ana Colecionadora',
  'Código de indicação': 'kurio-2026',
  'Nome ENS': 'anasouza',
}

/** Preenche os obrigatórios vazios (nome de exibição e e-mail já vêm da conta). */
function fillCollector() {
  for (const [label, value] of Object.entries(VALID_COLLECTOR)) fireEvent.change(collectorField(label), { target: { value } })
}

/** "Confirmar compra" da página → diálogo de revisão. */
async function openReview() {
  fireEvent.click(confirmButton())
  return screen.findByRole('dialog', { name: REVIEW_DIALOG_TITLE })
}

/** Preenche, abre a revisão e confirma nela (o caminho que envia o pedido). */
async function confirmThroughReview() {
  fillCollector()
  const dialog = await openReview()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar compra' }))
}

describe('CheckoutPage', () => {
  it('"Confirmar compra" bloqueado diz o motivo por aria-describedby e o perde ao habilitar', async () => {
    renderPage()
    await screen.findByText('Solar Veil')
    await screen.findByText('Escolha como conectar.')
    expect(confirmButton().getAttribute('aria-disabled')).toBe('true')
    expect(describedText(confirmButton())).toEqual(['Conecte uma carteira para confirmar.'])
    await connectAndWaitForConfirm()
    expect(confirmButton().getAttribute('aria-describedby')).toBeNull()
  })

  it('a página tem "Perfil do colecionador", "Seus NFTs" e "Carteira e rede", sem etapas numeradas', async () => {
    renderPage()
    await screen.findByText('Solar Veil')
    for (const name of ['Perfil do colecionador', 'Seus NFTs', 'Carteira e rede']) {
      expect(screen.getByRole('heading', { name }).textContent).toBe(name)
    }
    expect(screen.queryByRole('heading', { name: /Seus dados|Revisão/ })).toBeNull()
    // Nome de exibição e e-mail vêm da conta; Endereço é o da carteira escolhida, só leitura
    await waitFor(() => expect(collectorField('Nome de exibição').value).toBe('Ana Souza'))
    expect(collectorField('E-mail').value).toBe(ANA.email)
    expect(collectorField('Endereço da carteira').value).toBe(WALLET.address)
    expect(collectorField('Endereço da carteira').readOnly).toBe(true)
    // O cupom é o link do Figma
    expect(screen.getByRole('button', { name: 'Tem um código promocional? Aplique aqui' })).toBeTruthy()
  })

  it('"Confirmar compra" com o formulário vazio: erro em cada campo, foco no primeiro inválido e nenhum envio', async () => {
    renderPage()
    await connectAndWaitForConfirm()
    fireEvent.change(collectorField('Nome de exibição'), { target: { value: '' } })
    fireEvent.click(confirmButton())
    expect(document.activeElement).toBe(collectorField('Nome de exibição'))
    expect(describedText(collectorField('Nome de usuário'))).toEqual([COLLECTOR_MESSAGES.usernameRequired])
    expect(describedText(collectorField('Nome do perfil'))).toEqual([COLLECTOR_MESSAGES.profileNameRequired])
    expect(describedText(collectorField('Código de indicação'))).toEqual([COLLECTOR_MESSAGES.referralCodeRequired])
    expect(describedText(collectorField('Nome ENS'))).toEqual([COLLECTOR_MESSAGES.ensNameRequired])
    expect(collectorField('Nome de usuário').getAttribute('aria-invalid')).toBe('true')
    // Os opcionais vazios não acusam erro
    expect(collectorField('ENS ou carteira secundária').getAttribute('aria-invalid')).toBeNull()
    expect(describedText(confirmButton())).toEqual(['Revise os campos destacados.'])
    expect(screen.queryByRole('dialog')).toBeNull()
    await new Promise((r) => setTimeout(r, 20))
    expect(orderCalls()).toHaveLength(0)

    // Corrigidos os campos, o aviso some e a revisão abre
    fireEvent.change(collectorField('Nome de exibição'), { target: { value: 'Ana' } })
    fillCollector()
    expect(screen.queryByText('Revise os campos destacados.')).toBeNull()
    expect(await openReview()).toBeTruthy()
  })

  it('"Confirmar compra" sem conexão valida o formulário: os dois motivos aparecem e o foco vai ao primeiro inválido (R-25)', async () => {
    renderPage()
    await screen.findByText('Escolha como conectar.')
    await waitFor(() => expect(collectorField('Nome de exibição').value).toBe('Ana Souza'))
    fireEvent.click(confirmButton())
    expect(document.activeElement).toBe(collectorField('Nome de usuário'))
    expect(collectorField('Nome de usuário').getAttribute('aria-invalid')).toBe('true')
    expect(describedText(confirmButton())).toEqual(['Revise os campos destacados.', 'Conecte uma carteira para confirmar.'])
    expect(screen.queryByRole('dialog')).toBeNull()

    // Formulário válido e ainda sem conexão: só o motivo da conexão, sem revisão e sem envio
    fillCollector()
    fireEvent.click(confirmButton())
    expect(screen.queryByText('Revise os campos destacados.')).toBeNull()
    expect(describedText(confirmButton())).toEqual(['Conecte uma carteira para confirmar.'])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(orderCalls()).toHaveLength(0)
  })

  it('o erro de um campo editado aparece no blur e some ao editar', async () => {
    renderPage()
    await screen.findByText('Solar Veil')
    const username = collectorField('Nome de usuário')
    // Passar pelo campo sem editar não acusa nada
    fireEvent.blur(username)
    expect(username.getAttribute('aria-invalid')).toBeNull()
    fireEvent.change(username, { target: { value: 'Ana Souza' } })
    fireEvent.blur(username)
    expect(describedText(username)).toEqual([COLLECTOR_MESSAGES.usernameInvalid])
    fireEvent.change(username, { target: { value: 'ana_souza' } })
    expect(username.getAttribute('aria-invalid')).toBeNull()
  })

  it('a revisão mostra os dados, a carteira e o provedor; "Voltar e editar" fecha sem enviar e devolve o foco ao CTA', async () => {
    renderPage()
    await connectAndWaitForConfirm()
    fillCollector()
    const dialog = await openReview()
    for (const text of ['Ana Souza', 'ana_souza', 'Ana Colecionadora', ANA.email, 'KURIO-2026', 'anasouza.eth', 'Principal · Principal', 'Ethereum', 'MetaMask', 'Solar Veil']) {
      expect(within(dialog).getAllByText(text).length).toBeGreaterThan(0)
    }
    fireEvent.click(within(dialog).getByRole('button', { name: 'Voltar e editar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(confirmButton()))
    expect(orderCalls()).toHaveLength(0)
  })

  it('"Confirmar compra" na revisão envia um único POST /orders com { quoteId, walletId } (o corpo não muda)', async () => {
    postOrder = (_body, key) => Promise.resolve({ data: orderOf('q1', key) })
    renderPage()
    await connectAndWaitForConfirm()
    await confirmThroughReview()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/orders/$orderId', params: { orderId: 'o1' } })))
    expect(orderCalls()).toHaveLength(1)
    expect(orderCalls()[0]?.[1]).toEqual({ quoteId: 'q1', walletId: WALLET.id })
  })

  it('valores alterados na recotação: o aviso aparece e um novo "Confirmar compra" reabre a revisão com os valores novos', async () => {
    quotes = [quoteOf('q1'), quoteOf('q2', '0.5')]
    renderPage()
    await connectAndWaitForConfirm()
    await confirmThroughReview()
    // O aviso visível e a região role=status (sempre montada, MYK-1113) têm o mesmo texto: confere o anúncio
    await screen.findByText(/Os valores mudaram/, { selector: '[role="status"]' })
    expect(orderCalls()).toHaveLength(0)
    const dialog = await openReview()
    expect(within(dialog).getAllByText('0.5 ETH').length).toBeGreaterThan(0)
  })

  it('preço alterado (nft.updated) antes de abrir a revisão: o diálogo avisa com o diff e confirmar envia um único POST', async () => {
    postOrder = (_body, key) => Promise.resolve({ data: orderOf('q2', key) })
    const queryClient = renderPage()
    await connectAndWaitForConfirm()
    fillCollector()
    // O evento recota em segundo plano (0.35 → 0.5); a página só mostra o valor novo
    quotes = [quoteOf('q2', '0.5')]
    await act(() => queryClient.refetchQueries({ queryKey: quoteQuery(ANA.id, cart).queryKey }))
    await waitFor(() => expect(screen.getAllByText('0.5 ETH').length).toBeGreaterThan(0))
    await waitFor(() => expect(confirmButton().getAttribute('aria-disabled')).toBeNull())
    const dialog = await openReview()
    expect(within(dialog).getByText(REVIEW_VALUES_CHANGED_MESSAGE)).toBeTruthy()
    expect(within(dialog).getByText('Total: de 0.35 ETH para 0.5 ETH.')).toBeTruthy()
    expect(within(dialog).getByText('Preço alterado de 0.35 ETH para 0.5 ETH.')).toBeTruthy()
    // O diálogo foi a nova confirmação: o envio compara com q2 e sai sem outro aviso
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar compra' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/orders/$orderId' })))
    expect(orderCalls()).toHaveLength(1)
    expect(orderCalls()[0]?.[1]).toEqual({ quoteId: 'q2', walletId: WALLET.id })
    expect(screen.queryByText(VALUES_CHANGED_MESSAGE)).toBeNull()
  })

  it('sem mudança desde o último revisado, o diálogo não avisa', async () => {
    renderPage()
    await connectAndWaitForConfirm()
    fillCollector()
    const dialog = await openReview()
    expect(within(dialog).queryByText(REVIEW_VALUES_CHANGED_MESSAGE)).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Voltar e editar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(within(await openReview()).queryByText(REVIEW_VALUES_CHANGED_MESSAGE)).toBeNull()
  })

  it('preço alterado com o diálogo aberto: confirmar nele dá "Os valores mudaram" e não envia (R3)', async () => {
    const queryClient = renderPage()
    await connectAndWaitForConfirm()
    fillCollector()
    const dialog = await openReview()
    expect(within(dialog).queryByText(REVIEW_VALUES_CHANGED_MESSAGE)).toBeNull()
    quotes = [quoteOf('q2', '0.5')]
    await act(() => queryClient.refetchQueries({ queryKey: quoteQuery(ANA.id, cart).queryKey }))
    await waitFor(() => expect(confirmButton().getAttribute('aria-disabled')).toBeNull())
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar compra' }))
    await screen.findByText(VALUES_CHANGED_MESSAGE)
    expect(screen.getByText('Total: de 0.35 ETH para 0.5 ETH.')).toBeTruthy()
    expect(orderCalls()).toHaveLength(0)
  })

  it('cupom aplicado no Pagamento: a revisão mostra o diff do desconto, sem bloquear, e confirmar envia um único POST', async () => {
    const discounted: Quote = {
      ...quoteOf('q-cupom'),
      discount: parseEth('0.035'),
      total: parseEth('0.317'),
      coupon: { code: 'KURIO10', status: 'applied' },
    }
    api.put.mockImplementation((url: string, body: { code: string }) => {
      if (url !== '/cart/coupon') return Promise.reject(new Error(`PUT ${url} sem mock`))
      cart = { ...cart, couponCode: body.code.toUpperCase() }
      return Promise.resolve({ data: cart })
    })
    api.post.mockImplementation((url: string, _body: unknown, config?: { headers?: Record<string, string> }) => {
      if (url === '/quotes') return Promise.resolve({ data: cart.couponCode ? discounted : quoteOf('q1') })
      if (url === `/wallets/${WALLET.id}/connect`) return Promise.resolve({ data: WALLET })
      if (url === '/orders') return Promise.resolve({ data: orderOf('q-cupom', config?.headers?.['Idempotency-Key'] ?? '') })
      return Promise.reject(new Error(`POST ${url} sem mock`))
    })
    renderPage()
    await connectAndWaitForConfirm()
    fireEvent.click(screen.getByRole('button', { name: 'Tem um código promocional? Aplique aqui' }))
    fireEvent.change(screen.getByLabelText('Cupom de desconto'), { target: { value: 'kurio10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    await screen.findByText(/aplicado/)
    await waitFor(() => expect(confirmButton().getAttribute('aria-disabled')).toBeNull())
    fillCollector()
    const dialog = await openReview()
    expect(within(dialog).getAllByText('0.317 ETH').length).toBeGreaterThan(0)
    // A mudança é informada no diálogo (cupom e total), que é a nova confirmação: não bloqueia o envio
    expect(within(dialog).getByText(REVIEW_VALUES_CHANGED_MESSAGE)).toBeTruthy()
    expect(within(dialog).getByText('Cupom aplicado.')).toBeTruthy()
    expect(within(dialog).getByText('Total: de 0.35 ETH para 0.317 ETH.')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar compra' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/orders/$orderId' })))
    expect(orderCalls()).toHaveLength(1)
    expect(orderCalls()[0]?.[1]).toEqual({ quoteId: 'q-cupom', walletId: WALLET.id })
    expect(screen.queryByText(VALUES_CHANGED_MESSAGE)).toBeNull()
  })

  it('"Seus NFTs" mostra "(x N)" e o subtotal da linha (preço unitário × quantidade, só exibição)', async () => {
    cart = { items: [{ ...ITEM, quantity: 3 }] }
    quotes = [{ ...quoteOf('q1'), items: [{ ...ITEM, quantity: 3, unitPrice: parseEth('0.35') }] }]
    renderPage()
    const list = await screen.findByRole('region', { name: 'Seus NFTs' })
    await within(list).findByText('Solar Veil')
    expect(within(list).getByText('(x 3)')).toBeTruthy()
    await waitFor(() => expect(within(list).getAllByText('1.05 ETH').length).toBeGreaterThan(0))
    expect(within(list).getByText(/0\.35 ETH cada/)).toBeTruthy()
  })

  it('o formulário sobrevive a um remount (rascunho do checkout)', async () => {
    renderPage()
    await screen.findByText('Solar Veil')
    fillCollector()
    cleanup()
    renderPage()
    await screen.findByText('Solar Veil')
    for (const [label, value] of Object.entries(VALID_COLLECTOR)) expect(collectorField(label).value).toBe(value)
    expect(checkoutDraftStore(ANA.id).get().collector).toMatchObject({ username: 'ana_souza', ensName: 'anasouza' })
  })

  it('"Usar outra carteira?" sem outra carteira cadastrada: fica a principal e aparece o link para cadastrar', async () => {
    renderPage()
    await screen.findByText('Solar Veil')
    const toggle = await screen.findByRole('checkbox', { name: 'Usar outra carteira?' })
    expect(screen.getByRole('combobox', { name: /^Tipo de carteira/ }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText(ONLY_PRIMARY_MESSAGE)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Cadastrar outra carteira' }).getAttribute('href')).toBe('/wallets')
    expect(collectorField('Endereço da carteira').value).toBe(WALLET.address)
  })

  it('"Usar outra carteira?" habilita Rede e Tipo com as outras carteiras; escolher Polygon escolhe a Reserva dela', async () => {
    // O Select do Radix usa APIs de ponteiro e rolagem que o jsdom não tem
    Object.assign(Element.prototype, {
      hasPointerCapture: () => false,
      releasePointerCapture: () => undefined,
      scrollIntoView: () => undefined,
    })
    const travel: Wallet = { id: 'wallet-ana-2', address: '0x' + '2'.repeat(40), network: 'arbitrum', role: 'secondary', label: 'Viagem' }
    const vault: Wallet = { id: 'wallet-ana-3', address: '0x' + '3'.repeat(40), network: 'polygon', role: 'secondary', label: 'Cofre' }
    const get = api.get.getMockImplementation() as (url: string) => Promise<unknown>
    api.get.mockImplementation((url: string) => (url === '/wallets' ? Promise.resolve({ data: [WALLET, travel, vault] }) : get(url)))
    renderPage()
    await screen.findByText('Solar Veil')
    const network = () => screen.getByRole('combobox', { name: /^Rede/ })
    const type = () => screen.getByRole('combobox', { name: /^Tipo de carteira/ })
    await waitFor(() => expect(network().textContent).toContain('Ethereum'))
    expect(network().hasAttribute('disabled')).toBe(true)
    expect(type().hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Usar outra carteira?' }))
    // A primeira outra carteira (ordem de cadastro), e os selects habilitados
    expect(type().textContent).toBe('Reserva · Viagem')
    expect(collectorField('Endereço da carteira').value).toBe(travel.address)
    expect(network().hasAttribute('disabled')).toBe(false)

    fireEvent.keyDown(network(), { key: 'Enter' })
    const options = (await screen.findAllByRole('option')).map((option) => option.textContent)
    // Só as redes das outras carteiras
    expect(options).toEqual(['Polygon', 'Arbitrum'])
    fireEvent.keyDown(screen.getByRole('option', { name: 'Polygon' }), { key: 'Enter' })
    await waitFor(() => expect(type().textContent).toBe('Reserva · Cofre'))
    expect(collectorField('Endereço da carteira').value).toBe(vault.address)
    expect(checkoutDraftStore(ANA.id).get().walletId).toBe(vault.id)

    // Desmarcar volta à principal
    fireEvent.click(screen.getByRole('checkbox', { name: 'Usar outra carteira?' }))
    expect(collectorField('Endereço da carteira').value).toBe(WALLET.address)
  })

  it('duplo clique em "Confirmar compra" envia um único POST /orders (trava com useRef)', async () => {
    renderPage()
    await connectAndWaitForConfirm()
    fillCollector()
    const dialog = await openReview()
    const button = within(dialog).getByRole('button', { name: 'Confirmar compra' })
    // Os dois cliques no mesmo tick, sem render entre eles (o diálogo ainda montado, como na animação de saída no
    // browser): só a trava síncrona do `usePlaceOrder` segura o segundo
    act(() => {
      button.click()
      button.click()
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(orderCalls()).toHaveLength(1)
    await waitFor(() => expect(confirmButton().getAttribute('aria-busy')).toBe('true'))
    // O CTA ocupado não reabre a revisão nem envia de novo
    fireEvent.click(confirmButton())
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(orderCalls()).toHaveLength(1)
  })

  it('falha transitória troca o CTA por "Tentar de novo", com o foco nele, e reenvia a mesma chave e o mesmo corpo', async () => {
    postOrder = () => Promise.reject(new ApiError({ code: 'transient', message: 'timeout of 10000ms exceeded' }))
    renderPage()
    await connectAndWaitForConfirm()
    await confirmThroughReview()
    const retry = await screen.findByRole('button', { name: 'Tentar de novo' })
    expect(document.activeElement).toBe(retry)
    expect(screen.queryByRole('button', { name: /Confirmar compra/ })).toBeNull()
    expect(screen.getByText('Não confirmamos o envio.')).toBeTruthy()
    // A Revisão passa a mostrar a tentativa
    expect(screen.getByText(ATTEMPT_REVIEW_MESSAGE)).toBeTruthy()

    postOrder = (_body, key) => Promise.resolve({ data: orderOf('q1', key) })
    fireEvent.click(retry)
    // "Tentar de novo" reenvia direto: a revisão não abre
    expect(screen.queryByRole('dialog')).toBeNull()
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
    expect(screen.queryByRole('button', { name: /^Conectar/ })).toBeNull()
    expect(screen.queryByText('Escolha como conectar.')).toBeNull()
    // Os provedores também ficam travados, e o grupo se chama pelo título visível
    expect(screen.getByRole('radiogroup', { name: 'Carteira e rede' })).toBeTruthy()
    for (const radio of screen.getAllByRole('radio')) expect((radio as HTMLButtonElement).disabled).toBe(true)
  })

  it('conectar → "Desconectar": não conectada, foco no "Conectar com …" e "Confirmar compra" bloqueado com o motivo', async () => {
    renderPage()
    await connectAndWaitForConfirm()
    fireEvent.click(screen.getByRole('button', { name: 'Desconectar' }))
    const connect = screen.getByRole('button', { name: 'Conectar com MetaMask' })
    expect(document.activeElement).toBe(connect)
    expect(screen.queryByText('Principal conectada com MetaMask.')).toBeNull()
    expect(screen.getByText('Desconectada')).toBeTruthy()
    expect(confirmButton().getAttribute('aria-disabled')).toBe('true')
    expect(describedText(confirmButton())).toEqual(['Conecte uma carteira para confirmar.'])
    fireEvent.click(confirmButton())
    expect(orderCalls()).toHaveLength(0)
  })

  it('rascunho antigo conectado sem provedor: não conta como conectada, sem "Desconectar", e o CTA fica bloqueado', async () => {
    checkoutDraftStore(ANA.id).set({ walletId: WALLET.id, connectedWalletId: WALLET.id })
    renderPage()
    await screen.findByText('Escolha como conectar.')
    expect(screen.queryByRole('button', { name: 'Desconectar' })).toBeNull()
    expect(confirmButton().getAttribute('aria-disabled')).toBe('true')
    expect(describedText(confirmButton())).toEqual(['Conecte uma carteira para confirmar.'])
  })

  it('a recusa (409) aparece no WalletOption do provedor, com "Tentar novamente", e não envia pedido', async () => {
    const message = 'A carteira recusou a conexão. Aprove o pedido no app da carteira e tente de novo.'
    api.post.mockImplementation((url: string) => {
      if (url === '/quotes') return Promise.resolve({ data: quotes[0] })
      if (url === `/wallets/${WALLET.id}/connect`) return Promise.reject(new ApiError({ code: 'conflict', message }, 409))
      return Promise.reject(new Error(`POST ${url} sem mock`))
    })
    renderPage()
    fireEvent.click(await chooseProvider())
    const retry = await screen.findByRole('button', { name: 'Tentar novamente' })
    // O nome do rádio é só o provedor; a recusa vem uma vez, como descrição
    const radio = screen.getByRole('radio', { name: 'MetaMask' })
    expect(describedText(radio)).toEqual([message])
    const option = radio.closest('[data-slot="wallet-option"]')
    expect(option?.getAttribute('data-status')).toBe('rejected')
    expect(option?.textContent).toContain(message)
    expect(screen.getByRole('alert').textContent).toBe(message)
    expect(confirmButton().getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(retry)
    await waitFor(() => expect(api.post.mock.calls.filter(([url]) => url === `/wallets/${WALLET.id}/connect`)).toHaveLength(2))
    expect(orderCalls()).toHaveLength(0)
  })

  it('durante o "Confirmando…" a Revisão não troca para a tentativa; ao falhar, mostra a tentativa', async () => {
    renderPage()
    await screen.findByText('Solar Veil')
    await connectAndWaitForConfirm()
    await confirmThroughReview()
    await waitFor(() => expect(confirmButton().textContent).toContain('Confirmando…'))
    // O withOrderKey já gravou a tentativa, mas ela não aparece enquanto o envio está em voo
    expect(checkoutDraftStore(ANA.id).get().attempt).toBeDefined()
    expect(screen.queryByText(ATTEMPT_REVIEW_MESSAGE)).toBeNull()
  })

  it('depois da falha transitória a Revisão mostra a tentativa', async () => {
    postOrder = () => Promise.reject(new ApiError({ code: 'transient', message: 'timeout of 10000ms exceeded' }))
    renderPage()
    await screen.findByText('Solar Veil')
    await connectAndWaitForConfirm()
    await confirmThroughReview()
    await screen.findByRole('button', { name: 'Tentar de novo' })
    expect(screen.getByText(ATTEMPT_REVIEW_MESSAGE)).toBeTruthy()
  })

  it('a tentativa no mount esconde a cotação do carrinho: o revisado é o que a tela mostrou depois que ela sai', async () => {
    // A tentativa (q0) está na Revisão; a cotação do carrinho (q1 a 0.35) carrega sem aparecer
    const draft: CheckoutDraft = {
      walletId: WALLET.id,
      connectedWalletId: WALLET.id,
      provider: 'metamask',
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
    act(() => drafts.set({ walletId: WALLET.id, connectedWalletId: WALLET.id, provider: 'metamask' }))
    await waitFor(() => expect(confirmButton().getAttribute('aria-disabled')).toBeNull())
    expect(screen.getAllByText('0.5 ETH').length).toBeGreaterThan(0)

    // Confirmar compara com q2 (exibida), não com q1 (nunca exibida): nada mudou e o pedido sai
    postOrder = (_body, key) => Promise.resolve({ data: orderOf('q2', key) })
    await confirmThroughReview()
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

  it('a lista da tentativa tem o título "Pedido enviado", sem número de etapa', async () => {
    checkoutDraftStore(ANA.id).set(pendingDraft())
    renderPage()
    const heading = await screen.findByRole('heading', { name: ATTEMPT_SENT_TITLE })
    // Só o título: nenhum número solto ("3") antes dele, e nenhuma etapa "Revisão"
    expect(heading.textContent).toBe(ATTEMPT_SENT_TITLE)
    expect(screen.queryByRole('heading', { name: 'Revisão' })).toBeNull()
  })

  it('"Tentar de novo" reenvia o mesmo corpo (quoteId e carteira) com a mesma chave e abre a Confirmação', async () => {
    checkoutDraftStore(ANA.id).set(pendingDraft())
    postOrder = (_body, key) => Promise.resolve({ data: orderOf('q0', key) })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/orders/$orderId', params: { orderId: 'o1' } })))
    expect(orderCalls()).toHaveLength(1)
    expect(orderCalls()[0]?.[1]).toEqual({ quoteId: 'q0', walletId: WALLET.id })
    expect(orderCalls()[0]?.[2]).toEqual({ headers: { 'Idempotency-Key': 'k1' } })
  })

  it('pedido em andamento cuja consulta falhou: "Tentar novamente" na tela consulta de novo, sem reenviar', async () => {
    checkoutDraftStore(ANA.id).set({ ...pendingDraft(), orderId: 'o1' })
    const orderLoads = () => api.get.mock.calls.filter(([url]) => url === '/orders/o1')
    renderPage()
    expect(await screen.findByText(ORDER_LOAD_FAILED_MESSAGE)).toBeTruthy()
    expect(screen.getByText(ORDER_IN_PROGRESS_MESSAGE)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    const loadsBefore = orderLoads().length
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(orderLoads().length).toBe(loadsBefore + 1))
    expect(orderCalls()).toHaveLength(0)
    // A tentativa continua no rascunho: o pedido existe
    expect(checkoutDraftStore(ANA.id).get().idempotencyKey).toBe('k1')
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
