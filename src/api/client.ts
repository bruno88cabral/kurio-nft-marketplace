import axios, { isAxiosError } from 'axios'
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

// Normaliza qualquer falha em ApiError. Sem fallback de dados (enunciado §6).
apiClient.interceptors.response.use(undefined, (error: unknown) => {
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
