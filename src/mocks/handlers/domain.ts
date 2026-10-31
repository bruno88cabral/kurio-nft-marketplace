import { DomainError } from '../db/domainError'
import { apiError, raise } from './errors'

/**
 * Executa `fn` (tipicamente um `store.mutate` com as funções puras de `db/`) e traduz `DomainError`
 * em `raise(apiError(...))`. O rollback do `mutate` já aconteceu quando o erro chega aqui.
 */
export function domainGuard<T>(fn: () => T): T {
  try {
    return fn()
  } catch (e) {
    if (e instanceof DomainError) raise(apiError(e.status, e.code, e.message, e.fieldErrors))
    throw e
  }
}
