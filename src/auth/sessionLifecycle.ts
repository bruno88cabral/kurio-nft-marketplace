import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import { logout } from '@/api/auth'
import { queryClient as appQueryClient } from '@/app/queryClient'
import type { AuthResponse, Session } from '@/contracts'
import { reconnectSocket as appReconnectSocket } from '@/realtime/socket'
import {
  browserStorage,
  clearSession,
  readSession,
  SESSION_STORAGE_KEY,
  writeSession,
  type SessionStorageLike,
  type StoredSession,
} from './sessionStorage'
import { SESSION_QUERY_KEY } from './useSession'

/**
 * Raízes das chaves de query que pertencem a uma conta. Trocar de conta, sair ou expirar remove todas
 * (isolamento entre usuários). Chave privada nova precisa começar por uma destas; as públicas
 * (`['nfts', …]`) ficam no cache.
 */
export const PRIVATE_QUERY_ROOTS = ['session', 'favorites', 'profile', 'wallets', 'cart', 'orders'] as const
export type PrivateQueryRoot = (typeof PRIVATE_QUERY_ROOTS)[number]

const PRIVATE_ROOTS: ReadonlySet<unknown> = new Set<unknown>(PRIVATE_QUERY_ROOTS)

export function isPrivateQueryKey(key: QueryKey): boolean {
  return PRIVATE_ROOTS.has(key[0])
}

export const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Entre novamente.'

/** Rotas de entrada: a expiração não navega quando o usuário já está nelas. */
export const AUTH_ROUTES: readonly string[] = ['/login', '/signup']

/** `true` se o evento `storage` (de outra aba) mexeu na sessão; `key === null` é um `localStorage.clear()`. */
export function isSessionStorageEvent(event: Pick<StorageEvent, 'key'>): boolean {
  return event.key === SESSION_STORAGE_KEY || event.key === null
}

export type EndSessionReason = 'logout' | 'expired'

/** Navegação da expiração, injetada pelo `start.tsx` (o lifecycle não importa o router: evita ciclo). */
export interface ExpiredNavigation {
  /** Local atual; `href` é caminho + busca + hash (vira o `?redirect=`). */
  location: () => { pathname: string; href: string }
  toLogin: (redirect: string) => void
}

/** Chamado depois de cada login/cadastro (ex.: merge do carrinho do visitante, MYK-1051). */
export type SessionEstablishedHook = (auth: AuthResponse) => void | Promise<void>

type TimerHandle = ReturnType<typeof setTimeout>

export interface SessionLifecycleDeps {
  queryClient: QueryClient
  /** Storage da sessão; `null` = indisponível (a sessão só não persiste). */
  storage: () => SessionStorageLike | null
  reconnectSocket: (token: string | null) => void
  /** `POST /auth/logout`. */
  logout: () => Promise<void>
  /** Toast de erro. */
  notifyError: (message: string) => void
  now: () => number
  setTimeout: (callback: () => void, ms: number) => TimerHandle
  clearTimeout: (handle: TimerHandle) => void
}

export interface SessionLifecycle {
  /** Cancela e remove as queries privadas, esvazia a `MutationCache` e desarma o timer de expiração. */
  resetPrivateState: () => Promise<void>
  /** Login, cadastro ou troca de conta: reset, grava a sessão, popula `['session']`, reconecta o socket com o token, arma o timer e roda os hooks. */
  establishSession: (auth: AuthResponse) => Promise<void>
  /** `logout` chama a API (falha ignorada); nos dois motivos limpa a sessão, reseta o estado privado e reconecta anônimo. Não navega nem mostra toast. */
  endSession: (reason: EndSessionReason) => Promise<void>
  /** Expiração (401 com o token atual ou timer): `endSession('expired')` + um toast + `/login?redirect=`, uma vez por token. */
  notifyExpired: (token: string) => Promise<void>
  /** Arma o timer até `expiresAt` (substitui o anterior). Data passada ou inválida: não arma. */
  scheduleExpiry: (session: StoredSession) => void
  /** Boot: reconecta o socket com o token guardado (ou anônimo) e arma o timer. */
  resumeSession: () => void
  /** Registra um hook pós-login; devolve a função que o remove. */
  onSessionEstablished: (hook: SessionEstablishedHook) => () => void
  setExpiredNavigation: (navigation: ExpiredNavigation | null) => void
}

// setTimeout aceita no máximo 2^31-1 ms (~24,8 dias); acima disso o timer rearma em etapas
const MAX_TIMER_MS = 2_147_483_647

export function createSessionLifecycle(deps: SessionLifecycleDeps): SessionLifecycle {
  const { queryClient } = deps
  const hooks = new Set<SessionEstablishedHook>()
  const privateFilter = { predicate: (query: { queryKey: QueryKey }) => isPrivateQueryKey(query.queryKey) }
  let expiryTimer: TimerHandle | null = null
  let navigation: ExpiredNavigation | null = null
  // Último token cuja sessão já foi encerrada: vários 401 juntos, ou 401 + timer, viram UMA expiração
  let endedToken: string | null = null

  function clearExpiryTimer() {
    if (expiryTimer !== null) deps.clearTimeout(expiryTimer)
    expiryTimer = null
  }

  function currentToken(): string | null {
    const storage = deps.storage()
    return storage ? (readSession(storage, deps.now())?.token ?? null) : null
  }

  // Síncrono de propósito: entre o reset e a escrita da sessão nova nenhum render vê estado misto.
  // `reset()` antes do `removeQueries` porque remover não avisa os observers montados (o `useSession`
  // continuaria com a conta antiga até outro render); o reset notifica e o render seguinte já lê o cache novo.
  function dropPrivateState() {
    for (const query of queryClient.getQueryCache().findAll(privateFilter)) query.reset()
    queryClient.removeQueries(privateFilter)
    queryClient.getMutationCache().clear()
  }

  async function resetPrivateState() {
    clearExpiryTimer()
    await queryClient.cancelQueries(privateFilter)
    dropPrivateState()
  }

  function scheduleExpiry(session: StoredSession) {
    clearExpiryTimer()
    const expiresAt = Date.parse(session.expiresAt)
    const delay = expiresAt - deps.now()
    // Passado: `readSession` já trata como ausente; o timer não tem o que fazer
    if (Number.isNaN(delay) || delay <= 0) return
    expiryTimer = deps.setTimeout(() => {
      expiryTimer = null
      if (deps.now() < expiresAt) scheduleExpiry(session)
      else void notifyExpired(session.token)
    }, Math.min(delay, MAX_TIMER_MS))
  }

  async function establishSession(auth: AuthResponse) {
    const { token, expiresAt, account } = auth
    clearExpiryTimer()
    await queryClient.cancelQueries(privateFilter)
    dropPrivateState()
    const storage = deps.storage()
    if (storage) writeSession(storage, { token, expiresAt })
    queryClient.setQueryData<Session>(SESSION_QUERY_KEY, { token, expiresAt, account })
    deps.reconnectSocket(token)
    scheduleExpiry({ token, expiresAt })
    for (const hook of hooks) {
      try {
        await hook(auth)
      } catch (e) {
        // Um hook com falha não desfaz o login
        console.error('[session] hook pós-login falhou', e)
      }
    }
  }

  async function endSession(reason: EndSessionReason) {
    if (reason === 'logout') {
      // Um 401 do próprio logout não pode virar "sessão expirada"
      endedToken = currentToken() ?? endedToken
      try {
        await deps.logout()
      } catch {
        // Idempotente no servidor; a falha não pode deixar a conta logada aqui
      }
    }
    const storage = deps.storage()
    if (storage) clearSession(storage)
    await resetPrivateState()
    deps.reconnectSocket(null)
  }

  async function notifyExpired(token: string) {
    if (token === endedToken) return
    const current = currentToken()
    // Expiração de um token que já não é o da sessão (houve troca de conta): nada a fazer
    if (current !== null && current !== token) return
    endedToken = token
    await endSession('expired')
    deps.notifyError(SESSION_EXPIRED_MESSAGE)
    if (navigation) {
      const { pathname, href } = navigation.location()
      if (!AUTH_ROUTES.includes(pathname)) navigation.toLogin(href)
    }
  }

  function resumeSession() {
    const storage = deps.storage()
    const session = storage ? readSession(storage, deps.now()) : null
    deps.reconnectSocket(session?.token ?? null)
    if (session) scheduleExpiry(session)
  }

  return {
    resetPrivateState,
    establishSession,
    endSession,
    notifyExpired,
    scheduleExpiry,
    resumeSession,
    onSessionEstablished: (hook) => {
      hooks.add(hook)
      return () => void hooks.delete(hook)
    },
    setExpiredNavigation: (next) => {
      navigation = next
    },
  }
}

/** Instância do app (cache, socket, `localStorage`, toast e relógio reais). A navegação é registrada no `start.tsx`. */
export const sessionLifecycle: SessionLifecycle = createSessionLifecycle({
  queryClient: appQueryClient,
  storage: browserStorage,
  reconnectSocket: appReconnectSocket,
  logout,
  notifyError: (message) => void toast.error(message),
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle),
})
