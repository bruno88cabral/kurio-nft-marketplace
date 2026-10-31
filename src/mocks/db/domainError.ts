import type { ApiErrorCode } from '@/contracts'

/**
 * Erro de regra de negócio das funções puras de `db/{cart,quote,orders}.ts` (testáveis sem MSW).
 * Lançado dentro de `store.mutate` faz o rollback; o handler o traduz para `ApiErrorBody` com
 * `domainGuard` (`handlers/domain.ts`).
 */
export class DomainError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly fieldErrors?: Record<string, string>

  constructor(status: number, code: ApiErrorCode, message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.name = 'DomainError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export const conflict = (message: string, fieldErrors?: Record<string, string>) =>
  new DomainError(409, 'conflict', message, fieldErrors)
export const invalid = (message: string, fieldErrors?: Record<string, string>) =>
  new DomainError(422, 'validation', message, fieldErrors)
export const missing = (message: string) => new DomainError(404, 'not_found', message)
export const forbidden = (message: string) => new DomainError(403, 'forbidden', message)
