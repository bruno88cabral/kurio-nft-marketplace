import { MutationObserver, QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account, AuthResponse, Session } from '@/contracts'
import {
  createSessionLifecycle,
  isPrivateQueryKey,
  isSessionStorageEvent,
  PRIVATE_QUERY_ROOTS,
  SESSION_EXPIRED_MESSAGE,
  type ExpiredNavigation,
  type SessionLifecycleDeps,
} from './sessionLifecycle'
import { readSession, SESSION_STORAGE_KEY, writeSession, type SessionStorageLike } from './sessionStorage'
import { SESSION_QUERY_KEY } from './useSession'

function memory(): SessionStorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

const NOW = Date.parse('2026-10-31T12:00:00.000Z')
const ANA: Account = { id: 'acc-ana', email: 'ana@kurio.test', name: 'Ana Souza' }
const BRUNO: Account = { id: 'acc-bruno', email: 'bruno@kurio.test', name: 'Bruno Lima' }
const inSeconds = (s: number) => new Date(NOW + s * 1000).toISOString()
const auth = (token: string, account: Account, ttlSeconds = 3600): AuthResponse => ({
  token,
  expiresAt: inSeconds(ttlSeconds),
  account,
})

function setup(overrides: Partial<SessionLifecycleDeps> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const storage = memory()
  const reconnectSocket = vi.fn<(token: string | null) => void>()
  const logout = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  const notifyError = vi.fn<(message: string) => void>()
  const deps: SessionLifecycleDeps = {
    queryClient,
    storage: () => storage,
    reconnectSocket,
    logout,
    notifyError,
    // relógio e timers do vitest (fake): avançar o tempo dispara o timer de expiração
    now: () => Date.now(),
    setTimeout: (cb, ms) => setTimeout(cb, ms),
    clearTimeout: (h) => clearTimeout(h),
    ...overrides,
  }
  const lifecycle = createSessionLifecycle(deps)
  const navigation = {
    location: vi.fn(() => ({ pathname: '/nfts/nft-001', href: '/nfts/nft-001?edition=open' })),
    toLogin: vi.fn<(redirect: string) => void>(),
  } satisfies ExpiredNavigation
  lifecycle.setExpiredNavigation(navigation)
  return { lifecycle, queryClient, storage, reconnectSocket, logout, notifyError, navigation }
}

function seedCache(queryClient: QueryClient) {
  queryClient.setQueryData(['session'], { token: 'a', expiresAt: inSeconds(3600), account: ANA })
  queryClient.setQueryData(['favorites', 'a'], [{ nftId: 'nft-002', createdAt: inSeconds(0) }])
  queryClient.setQueryData(['profile', 'a'], { displayName: 'Ana' })
  queryClient.setQueryData(['wallets', 'a'], [])
  queryClient.setQueryData(['nfts', 'detail', 'nft-001'], { id: 'nft-001' })
  queryClient.setQueryData(['nfts', 'list', {}], { items: [] })
}

const has = (queryClient: QueryClient, key: readonly unknown[]) => queryClient.getQueryCache().find({ queryKey: key, exact: true }) !== undefined

beforeEach(() => {
  vi.useFakeTimers({ now: NOW })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isPrivateQueryKey', () => {
  it('as raízes privadas são exatamente as da conta', () => {
    expect(PRIVATE_QUERY_ROOTS).toEqual(['session', 'favorites', 'profile', 'wallets', 'cart', 'orders'])
  })

  it.each(PRIVATE_QUERY_ROOTS)('%s é privada (com ou sem accountId)', (root) => {
    expect(isPrivateQueryKey([root])).toBe(true)
    expect(isPrivateQueryKey([root, 'acc-ana'])).toBe(true)
  })

  it('chaves públicas e desconhecidas não são', () => {
    expect(isPrivateQueryKey(['nfts', 'list', {}])).toBe(false)
    expect(isPrivateQueryKey(['nfts', 'detail', 'nft-001'])).toBe(false)
    expect(isPrivateQueryKey(['favorite', 'nft-001'])).toBe(false) // chave de mutation, não de query
    expect(isPrivateQueryKey([])).toBe(false)
    expect(isPrivateQueryKey([{ root: 'session' }])).toBe(false)
  })
})

describe('isSessionStorageEvent', () => {
  it('só a chave da sessão (ou clear()) interessa', () => {
    expect(isSessionStorageEvent({ key: SESSION_STORAGE_KEY })).toBe(true)
    expect(isSessionStorageEvent({ key: null })).toBe(true)
    expect(isSessionStorageEvent({ key: 'kurio:mock:db' })).toBe(false)
  })
})

describe('resetPrivateState', () => {
  it('remove session/favorites/profile/wallets, mantém nfts e esvazia a MutationCache', async () => {
    const { lifecycle, queryClient } = setup()
    seedCache(queryClient)
    const mutation = new MutationObserver(queryClient, { mutationFn: () => new Promise<void>(() => undefined) })
    void mutation.mutate().catch(() => undefined)
    expect(queryClient.getMutationCache().getAll()).toHaveLength(1)

    await lifecycle.resetPrivateState()

    expect(has(queryClient, ['session'])).toBe(false)
    expect(has(queryClient, ['favorites', 'a'])).toBe(false)
    expect(has(queryClient, ['profile', 'a'])).toBe(false)
    expect(has(queryClient, ['wallets', 'a'])).toBe(false)
    expect(has(queryClient, ['nfts', 'detail', 'nft-001'])).toBe(true)
    expect(has(queryClient, ['nfts', 'list', {}])).toBe(true)
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
  })

  it('cancela a query privada em voo', async () => {
    const { lifecycle, queryClient } = setup()
    let aborted = false
    void queryClient
      .fetchQuery({
        queryKey: ['favorites', 'a'],
        queryFn: ({ signal }) =>
          new Promise((_, reject) => {
            signal.addEventListener('abort', () => {
              aborted = true
              reject(new Error('abort'))
            })
          }),
      })
      .catch(() => undefined)
    await lifecycle.resetPrivateState()
    expect(aborted).toBe(true)
    expect(has(queryClient, ['favorites', 'a'])).toBe(false)
  })

  it('avisa os observers montados (sem isso o useSession ficaria com a conta antiga até outro render)', async () => {
    const { lifecycle, queryClient } = setup()
    seedCache(queryClient)
    const observer = new QueryObserver<Session>(queryClient, { queryKey: SESSION_QUERY_KEY, enabled: false })
    const seen: (Session | undefined)[] = []
    const unsubscribe = observer.subscribe((r) => seen.push(r.data))
    await lifecycle.resetPrivateState()
    await vi.runAllTimersAsync() // o notifyManager do react-query entrega com setTimeout(0)
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.at(-1)).toBeUndefined()
    unsubscribe()
  })
})

describe('establishSession', () => {
  it('grava o storage, popula ["session"], reconecta com o token e limpa a conta anterior', async () => {
    const { lifecycle, queryClient, storage, reconnectSocket } = setup()
    seedCache(queryClient)
    const next = auth('tok-bruno', BRUNO)

    await lifecycle.establishSession(next)

    expect(readSession(storage, NOW)).toEqual({ token: 'tok-bruno', expiresAt: next.expiresAt })
    expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toEqual(next)
    expect(reconnectSocket).toHaveBeenLastCalledWith('tok-bruno')
    expect(has(queryClient, ['favorites', 'a'])).toBe(false)
    expect(has(queryClient, ['nfts', 'detail', 'nft-001'])).toBe(true)
  })

  it('roda os hooks de onSessionEstablished; falha num hook não desfaz o login', async () => {
    const { lifecycle, storage } = setup()
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const ok = vi.fn()
    lifecycle.onSessionEstablished(() => {
      throw new Error('merge falhou')
    })
    const remove = lifecycle.onSessionEstablished(ok)
    const next = auth('tok-ana', ANA)

    await lifecycle.establishSession(next)
    expect(ok).toHaveBeenCalledWith(next)
    expect(readSession(storage, NOW)?.token).toBe('tok-ana')

    remove()
    await lifecycle.establishSession(auth('tok-ana-2', ANA))
    expect(ok).toHaveBeenCalledTimes(1)
    error.mockRestore()
  })
})

describe('endSession', () => {
  it('logout: chama a API, limpa a sessão e o cache privado e reconecta sem token', async () => {
    const { lifecycle, queryClient, storage, reconnectSocket, logout, notifyError, navigation } = setup()
    await lifecycle.establishSession(auth('tok-ana', ANA))
    seedCache(queryClient)

    await lifecycle.endSession('logout')

    expect(logout).toHaveBeenCalledTimes(1)
    expect(storage.map.has(SESSION_STORAGE_KEY)).toBe(false)
    expect(has(queryClient, ['session'])).toBe(false)
    expect(has(queryClient, ['favorites', 'a'])).toBe(false)
    expect(has(queryClient, ['nfts', 'detail', 'nft-001'])).toBe(true)
    expect(reconnectSocket).toHaveBeenLastCalledWith(null)
    // sair não é expirar: sem toast nem navegação aqui (a tela de logout cuida disso)
    expect(notifyError).not.toHaveBeenCalled()
    expect(navigation.toLogin).not.toHaveBeenCalled()
  })

  it('logout com a API falhando ainda desloga', async () => {
    const { lifecycle, queryClient, storage, reconnectSocket, logout } = setup()
    logout.mockRejectedValue(new Error('offline'))
    await lifecycle.establishSession(auth('tok-ana', ANA))

    await expect(lifecycle.endSession('logout')).resolves.toBeUndefined()

    expect(storage.map.has(SESSION_STORAGE_KEY)).toBe(false)
    expect(has(queryClient, ['session'])).toBe(false)
    expect(reconnectSocket).toHaveBeenLastCalledWith(null)
  })

  it('expired: não chama a API de logout', async () => {
    const { lifecycle, storage, logout } = setup()
    await lifecycle.establishSession(auth('tok-ana', ANA))
    await lifecycle.endSession('expired')
    expect(logout).not.toHaveBeenCalled()
    expect(storage.map.has(SESSION_STORAGE_KEY)).toBe(false)
  })

  it('o logout desarma o timer de expiração', async () => {
    const { lifecycle, notifyError } = setup()
    await lifecycle.establishSession(auth('tok-ana', ANA, 15))
    await lifecycle.endSession('logout')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(notifyError).not.toHaveBeenCalled()
  })
})

describe('notifyExpired', () => {
  it('encerra a sessão, mostra o toast e navega para /login com o href atual', async () => {
    const { lifecycle, storage, notifyError, navigation, reconnectSocket } = setup()
    await lifecycle.establishSession(auth('tok-ana', ANA))

    await lifecycle.notifyExpired('tok-ana')

    expect(storage.map.has(SESSION_STORAGE_KEY)).toBe(false)
    expect(reconnectSocket).toHaveBeenLastCalledWith(null)
    expect(notifyError).toHaveBeenCalledExactlyOnceWith(SESSION_EXPIRED_MESSAGE)
    expect(navigation.toLogin).toHaveBeenCalledExactlyOnceWith('/nfts/nft-001?edition=open')
  })

  it('vários 401 do mesmo token: um toast e uma navegação', async () => {
    const { lifecycle, notifyError, navigation } = setup()
    await lifecycle.establishSession(auth('tok-ana', ANA))
    await Promise.all([lifecycle.notifyExpired('tok-ana'), lifecycle.notifyExpired('tok-ana'), lifecycle.notifyExpired('tok-ana')])
    expect(notifyError).toHaveBeenCalledTimes(1)
    expect(navigation.toLogin).toHaveBeenCalledTimes(1)
  })

  it('já em /login ou /signup: toast sem navegar', async () => {
    for (const pathname of ['/login', '/signup']) {
      const { lifecycle, notifyError, navigation } = setup()
      navigation.location.mockReturnValue({ pathname, href: `${pathname}?redirect=%2Fcart` })
      await lifecycle.establishSession(auth('tok-ana', ANA))
      await lifecycle.notifyExpired('tok-ana')
      expect(notifyError).toHaveBeenCalledTimes(1)
      expect(navigation.toLogin).not.toHaveBeenCalled()
    }
  })

  it('token que já não é o da sessão (troca de conta) é ignorado', async () => {
    const { lifecycle, storage, notifyError } = setup()
    await lifecycle.establishSession(auth('tok-bruno', BRUNO))
    await lifecycle.notifyExpired('tok-ana')
    expect(readSession(storage, NOW)?.token).toBe('tok-bruno')
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('um 401 do próprio logout não vira "sessão expirada"', async () => {
    const { lifecycle, logout, notifyError, navigation } = setup()
    await lifecycle.establishSession(auth('tok-ana', ANA))
    logout.mockImplementation(async () => {
      await lifecycle.notifyExpired('tok-ana') // o que o client faria com um 401 do POST /auth/logout
      throw new Error('401')
    })
    await lifecycle.endSession('logout')
    expect(notifyError).not.toHaveBeenCalled()
    expect(navigation.toLogin).not.toHaveBeenCalled()
  })
})

describe('timer de expiração', () => {
  it('dispara a expiração no expiresAt (relógio fake)', async () => {
    const { lifecycle, storage, notifyError, navigation } = setup()
    await lifecycle.establishSession(auth('tok-ana', ANA, 15))

    await vi.advanceTimersByTimeAsync(14_999)
    expect(notifyError).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(notifyError).toHaveBeenCalledExactlyOnceWith(SESSION_EXPIRED_MESSAGE)
    expect(navigation.toLogin).toHaveBeenCalledTimes(1)
    expect(storage.map.has(SESSION_STORAGE_KEY)).toBe(false)
  })

  it('timer + 401 do mesmo token: uma expiração só', async () => {
    const { lifecycle, notifyError } = setup()
    await lifecycle.establishSession(auth('tok-ana', ANA, 15))
    await lifecycle.notifyExpired('tok-ana') // 401 chegou antes
    await vi.advanceTimersByTimeAsync(20_000)
    expect(notifyError).toHaveBeenCalledTimes(1)
  })

  it('trocar de conta substitui o timer da anterior', async () => {
    const { lifecycle, notifyError, storage } = setup()
    await lifecycle.establishSession(auth('tok-ana', ANA, 15))
    await lifecycle.establishSession(auth('tok-bruno', BRUNO, 3600))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(notifyError).not.toHaveBeenCalled()
    expect(readSession(storage, Date.now())?.token).toBe('tok-bruno')
  })

  it('expiresAt no passado ou inválido não arma timer', () => {
    const { lifecycle } = setup()
    lifecycle.scheduleExpiry({ token: 't', expiresAt: inSeconds(-1) })
    lifecycle.scheduleExpiry({ token: 't', expiresAt: 'não é data' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('expiresAt além do limite do setTimeout rearma em etapas em vez de disparar cedo', async () => {
    const { lifecycle, notifyError } = setup()
    const far = 30 * 24 * 3600 // 30 dias > 2^31-1 ms
    await lifecycle.establishSession(auth('tok-ana', ANA, far))
    await vi.advanceTimersByTimeAsync(2_147_483_647)
    expect(notifyError).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(far * 1000 - 2_147_483_647)
    expect(notifyError).toHaveBeenCalledTimes(1)
  })
})

describe('resumeSession (boot)', () => {
  it('com sessão guardada: reconecta com o token e arma o timer', async () => {
    const { lifecycle, storage, reconnectSocket, notifyError } = setup()
    writeSession(storage, { token: 'tok-ana', expiresAt: inSeconds(15) })
    lifecycle.resumeSession()
    expect(reconnectSocket).toHaveBeenLastCalledWith('tok-ana')
    await vi.advanceTimersByTimeAsync(15_000)
    expect(notifyError).toHaveBeenCalledExactlyOnceWith(SESSION_EXPIRED_MESSAGE)
  })

  it('sem sessão (ou vencida): conecta anônimo e não arma timer', () => {
    const { lifecycle, storage, reconnectSocket } = setup()
    writeSession(storage, { token: 'tok-ana', expiresAt: inSeconds(-1) })
    lifecycle.resumeSession()
    expect(reconnectSocket).toHaveBeenLastCalledWith(null)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('storage indisponível: anônimo, sem quebrar', () => {
    const { lifecycle, reconnectSocket } = setup({ storage: () => null })
    lifecycle.resumeSession()
    expect(reconnectSocket).toHaveBeenLastCalledWith(null)
  })
})
