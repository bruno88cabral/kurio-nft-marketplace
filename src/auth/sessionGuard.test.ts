import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { ApiError, type Account, type AuthResponse, type Favorite, type Profile } from '@/contracts'
import { favoriteMutationOptions } from '@/features/favorites/favoriteCache'
import { isSameSession } from './sessionGuard'
import { createSessionLifecycle, type SessionCheck } from './sessionLifecycle'
import type { SessionStorageLike } from './sessionStorage'

const ANA: Account = { id: 'user-ana', email: 'ana@kurio.test', name: 'Ana Souza' }
const BRUNO: Account = { id: 'user-bruno', email: 'bruno@kurio.test', name: 'Bruno Lima' }
const auth = (token: string, account: Account): AuthResponse => ({
  token,
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  account,
})
const ANA_PROFILE: Profile = { accountId: ANA.id, displayName: 'Ana Vazou', wallets: [] }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const map = new Map<string, string>()
  const storage: SessionStorageLike = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
  const lifecycle = createSessionLifecycle({
    queryClient,
    storage: () => storage,
    reconnectSocket: () => undefined,
    logout: () => Promise.resolve(),
    notifyError: () => undefined,
    now: () => Date.now(),
    setTimeout: (cb, ms) => setTimeout(cb, ms),
    clearTimeout: (h) => clearTimeout(h),
  })
  return { queryClient, lifecycle }
}

const has = (queryClient: QueryClient, key: readonly unknown[]) =>
  queryClient.getQueryCache().find({ queryKey: key, exact: true }) !== undefined

/** A Ana sai e o Bruno entra (o mesmo caminho do "Sair" + login). */
async function switchToBruno(lifecycle: ReturnType<typeof setup>['lifecycle']) {
  await lifecycle.endSession('logout')
  await lifecycle.establishSession(auth('tok-bruno', BRUNO))
}

describe('captureSession', () => {
  it('vale até o próximo login, logout, expiração ou reset', async () => {
    const { lifecycle } = setup()
    await lifecycle.establishSession(auth('tok-ana', ANA))
    const check = lifecycle.captureSession()
    expect(check()).toBe(true)

    await lifecycle.establishSession(auth('tok-bruno', BRUNO))
    expect(check()).toBe(false)

    const afterLogin = lifecycle.captureSession()
    await lifecycle.endSession('expired')
    expect(afterLogin()).toBe(false)

    const afterExpiry = lifecycle.captureSession()
    await lifecycle.resetPrivateState()
    expect(afterExpiry()).toBe(false)
  })

  it('já muda no início do logout (antes de a API responder)', async () => {
    const { lifecycle } = setup()
    await lifecycle.establishSession(auth('tok-ana', ANA))
    const check = lifecycle.captureSession()
    const ending = lifecycle.endSession('logout')
    expect(check()).toBe(false)
    await ending
  })
})

describe('isSameSession no padrão das mutations da conta (QueryClient real): mutation da conta anterior em voo durante a troca de conta', () => {
  function profileMutation(queryClient: QueryClient, lifecycle: ReturnType<typeof setup>['lifecycle']) {
    const request = deferred<Profile>()
    const onSuccess = vi.fn((next: Profile) => {
      // o que o ProfileForm/AvatarField fazem no sucesso: grava na chave da conta e mostra o toast
      queryClient.setQueryData(['profile', next.accountId], next)
    })
    const onError = vi.fn()
    // o mesmo padrão de useAccountForm, AvatarField e WalletList
    const observer = new MutationObserver<Profile, Error, string, SessionCheck>(queryClient, {
      mutationFn: () => request.promise,
      onMutate: () => lifecycle.captureSession(),
      onSuccess: (next, _displayName, sameSession) => {
        if (isSameSession(sameSession)) onSuccess(next)
      },
      onError: (error, _displayName, sameSession) => {
        if (isSameSession(sameSession)) onError(error)
      },
    })
    return { request, onSuccess, onError, observer }
  }

  it('PATCH da Ana que responde depois de o Bruno entrar: sem callback e sem ["profile","user-ana"]', async () => {
    const { queryClient, lifecycle } = setup()
    await lifecycle.establishSession(auth('tok-ana', ANA))
    const { request, onSuccess, observer } = profileMutation(queryClient, lifecycle)

    const done = observer.mutate('Ana Vazou')
    await vi.waitFor(() => expect(observer.getCurrentResult().isPending).toBe(true))
    await switchToBruno(lifecycle)
    request.resolve(ANA_PROFILE)
    await done

    expect(onSuccess).not.toHaveBeenCalled()
    expect(has(queryClient, ['profile', ANA.id])).toBe(false)
  })

  it('falha da Ana que volta depois do logout: sem callback (nada de toast/erro no formulário)', async () => {
    const { queryClient, lifecycle } = setup()
    await lifecycle.establishSession(auth('tok-ana', ANA))
    const { request, onError, observer } = profileMutation(queryClient, lifecycle)

    const done = observer.mutate('Ana Vazou').catch((e: unknown) => e)
    await vi.waitFor(() => expect(observer.getCurrentResult().isPending).toBe(true))
    await lifecycle.endSession('logout')
    request.reject(new ApiError({ code: 'transient', message: 'x' }, 503))
    await done

    expect(onError).not.toHaveBeenCalled()
  })

  it('na mesma sessão os callbacks rodam normalmente', async () => {
    const { queryClient, lifecycle } = setup()
    await lifecycle.establishSession(auth('tok-ana', ANA))
    const { request, onSuccess, observer } = profileMutation(queryClient, lifecycle)

    const done = observer.mutate('Ana Vazou')
    request.resolve(ANA_PROFILE)
    await done

    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(queryClient.getQueryData(['profile', ANA.id])).toEqual(ANA_PROFILE)
  })
})

describe('favoriteMutationOptions com a sessão trocada antes da resposta', () => {
  const KEY = ['favorites', ANA.id]

  it('falha da Ana depois do logout: sem rollback (a chave não volta), sem aviso e sem invalidação', async () => {
    const { queryClient, lifecycle } = setup()
    await lifecycle.establishSession(auth('tok-ana', ANA))
    queryClient.setQueryData<Favorite[]>(KEY, [])
    const request = deferred<void>()
    const onFailure = vi.fn()
    const observer = new MutationObserver(
      queryClient,
      favoriteMutationOptions({
        queryClient,
        accountId: ANA.id,
        nftId: 'nft-002',
        request: () => request.promise,
        now: () => new Date().toISOString(),
        onFailure,
        captureSession: lifecycle.captureSession,
      }),
    )

    const done = observer.mutate(true).catch((e: unknown) => e)
    await vi.waitFor(() => expect(queryClient.getQueryData(KEY)).toHaveLength(1))
    await switchToBruno(lifecycle)
    expect(has(queryClient, KEY)).toBe(false)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    request.reject(new Error('503'))
    await done

    expect(has(queryClient, KEY)).toBe(false)
    expect(onFailure).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
  })
})
