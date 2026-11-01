import axios, { isAxiosError, isCancel, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { API_URL } from '@/app/env'
import { clearStoredSession, getToken } from '@/auth/sessionStorage'
import { ApiError, isApiErrorBody, type ApiErrorCode } from '@/contracts/errors'

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
})

/**
 * Rotas que criam a sessão: não levam o Bearer. Um 401 nelas é "credenciais inválidas", não sessão
 * morta, e não pode apagar a sessão de quem já está logado (MYK-1078).
 */
export const AUTH_ENTRY_PATHS: readonly string[] = ['/auth/login', '/auth/signup']

function isAuthEntryPath(url: string | undefined): boolean {
  if (url === undefined) return false
  const path = url.split(/[?#]/, 1)[0] ?? ''
  return AUTH_ENTRY_PATHS.includes(path.replace(/\/+$/, ''))
}

// Token que ESTA request levou. Um 401 só derruba a sessão se veio do token atual: uma request em voo
// com o token antigo não pode apagar a sessão nova (MYK-1078). O `config` é o mesmo objeto que volta em `error.config`.
const sentTokens = new WeakMap<InternalAxiosRequestConfig, string>()

// Sessão: Bearer em toda request quando há token válido guardado, menos nas rotas de entrada
apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token && !isAuthEntryPath(config.url)) {
    config.headers.set('Authorization', `Bearer ${token}`)
    sentTokens.set(config, token)
  }
  return config
})

// `client.ts` não importa `queryClient.ts` (ciclo); quem sabe resetar o estado registra o callback (start.tsx).
// Recebe o token que morreu, para o ciclo de vida deduplicar (vários 401 do mesmo token = uma expiração).
let unauthorizedHandler: ((token: string) => void) | null = null
export function onUnauthorized(callback: ((token: string) => void) | null): void {
  unauthorizedHandler = callback
}

const CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
}

// A API só fala JSON. HTML com 2xx é o fallback da SPA (Vite/Vercel) respondendo /api sem API atrás,
// por exemplo com VITE_ENABLE_MOCKS=false. Tratar como indisponível em vez de sucesso.
function isHtmlResponse(response: AxiosResponse) {
  const contentType: unknown = response.headers['content-type']
  return typeof contentType === 'string' && contentType.includes('text/html')
}

// Normaliza qualquer falha em ApiError. Sem fallback de dados (enunciado §6).
apiClient.interceptors.response.use((response) => {
  if (isHtmlResponse(response)) {
    throw new ApiError(
      { code: 'transient', message: 'Resposta HTML em vez de JSON: API indisponível' },
      response.status,
    )
  }
  return response
}, (error: unknown) => {
  if (isCancel(error)) throw error // descarte proposital (signal abortado), não é falha
  if (!isAxiosError(error)) {
    throw error
  }
  const { response } = error
  // 401 numa request que levou o token ATUAL: a sessão morreu. Sem token (visitante, rotas de entrada)
  // ou com um token que já não é o guardado, é só um ApiError para quem chamou e nada a limpar.
  const sentToken = error.config ? sentTokens.get(error.config) : undefined
  if (response?.status === 401 && sentToken !== undefined && sentToken === getToken()) {
    clearStoredSession()
    unauthorizedHandler?.(sentToken)
  }
  if (response && isApiErrorBody(response.data)) {
    throw new ApiError(response.data, response.status, { cause: error })
  }
  // Sem resposta (rede/timeout) ou resposta fora do contrato em 5xx/408/429: transitório
  const isTransient =
    !response || response.status >= 500 || response.status === 408 || response.status === 429
  const code: ApiErrorCode = isTransient
    ? 'transient'
    : (CODE_BY_STATUS[response.status] ?? 'validation')
  throw new ApiError({ code, message: error.message }, response?.status, { cause: error })
})
