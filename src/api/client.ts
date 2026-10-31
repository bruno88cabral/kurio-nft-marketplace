import axios, { isAxiosError, isCancel, type AxiosResponse } from 'axios'
import { API_URL } from '@/app/env'
import { clearStoredSession, getToken } from '@/auth/sessionStorage'
import { ApiError, isApiErrorBody, type ApiErrorCode } from '@/contracts/errors'

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
})

// Sessão: Bearer em toda request quando há token válido guardado
apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

// `client.ts` não importa `queryClient.ts` (ciclo); quem sabe invalidar o cache registra o callback (start.tsx)
let unauthorizedHandler: (() => void) | null = null
export function onUnauthorized(callback: (() => void) | null): void {
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
  // 401 numa request que levou token: a sessão morreu. Sem token, é só "não logado" e nada a limpar.
  if (response?.status === 401 && error.config?.headers.has('Authorization')) {
    clearStoredSession()
    unauthorizedHandler?.()
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
