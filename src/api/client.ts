import axios, { isAxiosError, type AxiosResponse } from 'axios'
import { ApiError, isApiErrorBody, type ApiErrorCode } from '@/contracts/errors'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 10_000,
})

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
  if (!isAxiosError(error)) {
    throw error
  }
  const { response } = error
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
