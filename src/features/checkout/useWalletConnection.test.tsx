// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type Wallet } from '@/contracts'
import { createDraftStore, type CheckoutDraft } from './checkoutDraft'
import { useWalletConnection } from './useWalletConnection'

const post = vi.hoisted(() => vi.fn())
// `false` simula a sessão trocada (logout, outra conta) entre o pedido e a resposta
const session = vi.hoisted(() => ({ same: true }))
vi.mock('@/api/client', () => ({ apiClient: { post } }))
vi.mock('@/auth/sessionGuard', () => ({ captureSession: () => () => session.same }))

const wallet = (id: string, network: Wallet['network'], role: Wallet['role'], label: string): Wallet => ({
  id,
  address: '0x' + id.padEnd(40, '0').slice(0, 40),
  network,
  role,
  label,
})
// Já na ordem de `sortWallets` (principal primeiro)
const PRIMARY = wallet('w1', 'ethereum', 'primary', 'Principal')
const POLYGON = wallet('w2', 'polygon', 'secondary', 'Cofre')
const POLYGON_2 = wallet('w3', 'polygon', 'secondary', 'Outra')
const WALLETS = [PRIMARY, POLYGON, POLYGON_2]

const PENDING: CheckoutDraft = {
  walletId: 'w1',
  connectedWalletId: 'w1',
  provider: 'metamask',
  idempotencyKey: 'k1',
  keyFingerprint: 'q1:w1',
  attempt: { quoteId: 'q1', walletId: 'w1' },
}

function setup(draft: CheckoutDraft, wallets: readonly Wallet[] = WALLETS) {
  const drafts = createDraftStore('user-ana', null)
  drafts.set(draft)
  const { result } = renderHook(() => {
    const current = useSyncExternalStore(drafts.subscribe, drafts.get)
    return useWalletConnection({ draft: current, drafts, wallets })
  })
  return { result, drafts }
}

/** Uma resposta de `POST /wallets/:id/connect` que o teste resolve ou rejeita quando quiser. */
function deferredConnect() {
  let resolve!: (wallet: Wallet) => void
  let reject!: (error: unknown) => void
  post.mockImplementationOnce(
    () =>
      new Promise((res, rej) => {
        resolve = (w) => res({ data: w })
        reject = rej
      }),
  )
  return { resolve: (w: Wallet) => resolve(w), reject: (e: unknown) => reject(e) }
}

afterEach(() => {
  cleanup()
  post.mockReset()
  session.same = true
})

/** Começa um `connect` sem esperar a resposta. */
function startConnect(result: { current: ReturnType<typeof useWalletConnection> }) {
  let promise!: Promise<void>
  act(() => {
    promise = result.current.connect()
  })
  return promise
}

describe('useWalletConnection', () => {
  it('sem rascunho: a principal escolhida e sem provedor', () => {
    const { result } = setup({})
    expect(result.current.selected).toEqual(PRIMARY)
    expect(result.current.useOther).toBe(false)
    expect(result.current.provider).toBeUndefined()
    expect(result.current.connection).toEqual({ status: 'idle' })
  })

  it('selectWallet troca a carteira (e a rede dela) e desconecta; a mesma carteira não desconecta', () => {
    const { result, drafts } = setup({ walletId: 'w1', connectedWalletId: 'w1', provider: 'metamask' })
    act(() => result.current.selectWallet('w1'))
    expect(result.current.connected).toBe(true)
    act(() => result.current.selectWallet('w2'))
    expect(result.current.selected).toEqual(POLYGON)
    expect(result.current.connected).toBe(false)
    expect(drafts.get()).toEqual({ walletId: 'w2', provider: 'metamask' })
  })

  it('setUseOther liga a primeira não principal e, desligado, volta à principal', () => {
    const { result } = setup({})
    act(() => result.current.setUseOther(true))
    expect(result.current.selectedId).toBe('w2')
    expect(result.current.useOther).toBe(true)
    act(() => result.current.setUseOther(false))
    expect(result.current.selectedId).toBe('w1')
    expect(result.current.useOther).toBe(false)
  })

  it('setUseOther(true) sem outra carteira não muda nada', () => {
    const { result } = setup({}, [PRIMARY])
    act(() => result.current.setUseOther(true))
    expect(result.current.selectedId).toBe('w1')
    expect(result.current.useOther).toBe(false)
  })

  it('selectProvider grava o provedor e desconecta; o mesmo provedor não desconecta', () => {
    const { result, drafts } = setup({ walletId: 'w1', connectedWalletId: 'w1', provider: 'metamask' })
    act(() => result.current.selectProvider('metamask'))
    expect(result.current.connected).toBe(true)
    act(() => result.current.selectProvider('coinbase'))
    expect(result.current.provider).toBe('coinbase')
    expect(result.current.connected).toBe(false)
    expect(drafts.get()).toEqual({ walletId: 'w1', provider: 'coinbase' })
  })

  it('disconnect tira só connectedWalletId e mostra "disconnected" até a próxima ação', () => {
    const draft: CheckoutDraft = { walletId: 'w1', connectedWalletId: 'w1', provider: 'metamask', collector: { email: 'ana@kurio.test' } }
    const { result, drafts } = setup(draft)
    act(() => result.current.disconnect())
    expect(drafts.get()).toEqual({ walletId: 'w1', provider: 'metamask', collector: { email: 'ana@kurio.test' } })
    expect(result.current.connected).toBe(false)
    expect(result.current.connection).toEqual({ status: 'disconnected' })
    act(() => result.current.selectProvider('coinbase'))
    expect(result.current.connection).toEqual({ status: 'idle' })
  })

  it('com tentativa pendente, carteira, outra carteira, provedor e desconectar não mudam nada (R4)', () => {
    const { result, drafts } = setup(PENDING)
    act(() => {
      result.current.setUseOther(true)
      result.current.selectProvider('coinbase')
      result.current.selectWallet('w2')
      result.current.disconnect()
    })
    expect(drafts.get()).toEqual(PENDING)
    expect(result.current.selectedId).toBe('w1')
    expect(result.current.connected).toBe(true)
  })

  it('connect sem provedor não chama a API', async () => {
    const { result } = setup({})
    await act(() => result.current.connect())
    expect(post).not.toHaveBeenCalled()
  })

  it('connect com provedor conecta a escolhida', async () => {
    post.mockResolvedValueOnce({ data: PRIMARY })
    const { result, drafts } = setup({ provider: 'walletconnect' })
    await act(() => result.current.connect())
    expect(post).toHaveBeenCalledWith('/wallets/w1/connect')
    expect(result.current.connection).toEqual({ status: 'connected' })
    expect(drafts.get()).toEqual({ provider: 'walletconnect', walletId: 'w1', connectedWalletId: 'w1' })
  })

  it('a resposta atrasada de connect depois de trocar o provedor não conecta', async () => {
    const response = deferredConnect()
    const { result, drafts } = setup({ provider: 'metamask' })
    let connecting!: Promise<void>
    act(() => {
      connecting = result.current.connect()
    })
    expect(result.current.connection).toEqual({ status: 'connecting' })
    act(() => result.current.selectProvider('coinbase'))
    // O "Conectando…" era do MetaMask: com o Coinbase escolhido não aparece
    expect(result.current.connection).toEqual({ status: 'idle' })
    await act(async () => {
      response.resolve(PRIMARY)
      await connecting
    })
    expect(result.current.connected).toBe(false)
    expect(drafts.get().connectedWalletId).toBeUndefined()
  })

  it('a recusa (409) depois de trocar o provedor não vira erro do novo provedor', async () => {
    const response = deferredConnect()
    const { result } = setup({ provider: 'metamask' })
    let connecting!: Promise<void>
    act(() => {
      connecting = result.current.connect()
    })
    act(() => result.current.selectProvider('coinbase'))
    await act(async () => {
      response.reject(new ApiError({ code: 'conflict', message: 'A carteira recusou a conexão.' }, 409))
      await connecting
    })
    expect(result.current.connection).toEqual({ status: 'idle' })
  })

  it('a recusa (409) vira "rejected" com a mensagem do servidor', async () => {
    post.mockRejectedValueOnce(new ApiError({ code: 'conflict', message: 'A carteira recusou a conexão.' }, 409))
    const { result } = setup({ provider: 'metamask' })
    await act(() => result.current.connect())
    expect(result.current.connection).toEqual({ status: 'rejected', message: 'A carteira recusou a conexão.' })
  })

  it('a resposta atrasada não conecta depois de a seleção mudar e voltar (MetaMask → Coinbase → MetaMask)', async () => {
    const response = deferredConnect()
    const { result, drafts } = setup({ provider: 'metamask' })
    const connecting = startConnect(result)
    act(() => result.current.selectProvider('coinbase'))
    act(() => result.current.selectProvider('metamask'))
    expect(result.current.connection).toEqual({ status: 'idle' })
    await act(async () => {
      response.resolve(PRIMARY)
      await connecting
    })
    expect(result.current.connected).toBe(false)
    expect(drafts.get().connectedWalletId).toBeUndefined()
  })

  it('conexões sobrepostas e "Desconectar": nenhuma resposta tardia reconecta', async () => {
    const first = deferredConnect()
    const second = deferredConnect()
    const { result, drafts } = setup({ provider: 'metamask' })
    const one = startConnect(result)
    act(() => result.current.selectProvider('coinbase'))
    act(() => result.current.selectProvider('metamask'))
    const two = startConnect(result)
    await act(async () => {
      second.resolve(PRIMARY)
      await two
    })
    expect(result.current.connected).toBe(true)
    act(() => result.current.disconnect())
    await act(async () => {
      first.resolve(PRIMARY)
      await one
    })
    expect(result.current.connected).toBe(false)
    expect(result.current.connection).toEqual({ status: 'disconnected' })
    expect(drafts.get().connectedWalletId).toBeUndefined()
  })

  it('trocar de carteira durante a conexão: a resposta não conecta nenhuma das duas', async () => {
    const response = deferredConnect()
    const { result, drafts } = setup({ provider: 'metamask' })
    const connecting = startConnect(result)
    act(() => result.current.selectWallet('w2'))
    expect(result.current.connection).toEqual({ status: 'idle' })
    await act(async () => {
      response.resolve(PRIMARY)
      await connecting
    })
    expect(result.current.connected).toBe(false)
    expect(drafts.get()).toEqual({ provider: 'metamask', walletId: 'w2' })
  })

  it('sessão trocada antes da resposta: não conecta e não mostra erro', async () => {
    const ok = deferredConnect()
    const { result, drafts } = setup({ provider: 'metamask' })
    const connecting = startConnect(result)
    session.same = false
    await act(async () => {
      ok.resolve(PRIMARY)
      await connecting
    })
    expect(drafts.get().connectedWalletId).toBeUndefined()
    expect(result.current.connection).toEqual({ status: 'idle' })

    const refused = deferredConnect()
    session.same = true
    const again = startConnect(result)
    session.same = false
    await act(async () => {
      refused.reject(new ApiError({ code: 'conflict', message: 'A carteira recusou a conexão.' }, 409))
      await again
    })
    expect(result.current.connection).toEqual({ status: 'idle' })
  })

  it('rascunho antigo com connectedWalletId e sem provedor não conta como conectado', () => {
    const { result } = setup({ walletId: 'w1', connectedWalletId: 'w1' })
    expect(result.current.connected).toBe(false)
    expect(result.current.connection).toEqual({ status: 'idle' })
  })
})
