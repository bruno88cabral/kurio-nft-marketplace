export type ApiErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'transient'

export interface ApiErrorBody {
  code: ApiErrorCode
  message: string
  fieldErrors?: Record<string, string>
}

const API_ERROR_CODES: readonly string[] = [
  'validation',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'transient',
]

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false
  const { code, message } = value as Record<string, unknown>
  return typeof message === 'string' && typeof code === 'string' && API_ERROR_CODES.includes(code)
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  /** Status HTTP; `undefined` quando não houve resposta (rede/timeout). */
  readonly status?: number
  readonly fieldErrors?: Record<string, string>

  constructor(body: ApiErrorBody, status?: number, options?: ErrorOptions) {
    super(body.message, options)
    this.name = 'ApiError'
    this.code = body.code
    this.status = status
    this.fieldErrors = body.fieldErrors
  }
}
