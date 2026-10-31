import { HttpResponse } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/contracts'

/** Todo erro do mock passa por aqui: o `apiClient` só preserva `code`/`fieldErrors` do formato `ApiErrorBody`. */
export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  fieldErrors?: Record<string, string>,
) {
  const body: ApiErrorBody = fieldErrors ? { code, message, fieldErrors } : { code, message }
  return HttpResponse.json<ApiErrorBody>(body, { status })
}

/** Carrega uma resposta de erro até o `withScenario` (o lint só aceita lançar `Error`). */
export class RaisedResponse extends Error {
  readonly response: Response
  constructor(response: Response) {
    super(`HTTP ${response.status}`)
    this.name = 'RaisedResponse'
    this.response = response
  }
}

/** Interrompe o resolver (e dá rollback num `store.mutate` em andamento) com esta resposta. */
export function raise(response: Response): never {
  throw new RaisedResponse(response)
}

export const validationError = (fieldErrors: Record<string, string>, message = 'Dados inválidos.') =>
  apiError(422, 'validation', message, fieldErrors)

export const notFound = (message = 'Recurso não encontrado.') => apiError(404, 'not_found', message)

/** Lê o corpo JSON; ausente, malformado ou que não seja objeto vira 422 (lançado). */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    raise(apiError(422, 'validation', 'Corpo da requisição inválido.'))
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    raise(apiError(422, 'validation', 'Corpo da requisição inválido.'))
  }
  return body as Record<string, unknown>
}

export function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}
