import { sessionLifecycle, type SessionCheck } from './sessionLifecycle'

/**
 * Guarda de sessão das mutations da conta. O `MutationCache.clear()` do reset não impede que uma
 * request em voo da conta anterior termine e rode `onSuccess`/`onError` na sessão seguinte (toast
 * da Ana na sessão do Bruno, `setQueryData` recriando a chave dela). Padrão:
 *
 * ```ts
 * useMutation({
 *   mutationFn,
 *   onMutate: captureSession,
 *   onSuccess: (data, variables, sameSession) => {
 *     if (!isSameSession(sameSession)) return
 *     …
 *   },
 * })
 * ```
 *
 * (Um wrapper que recebesse os callbacks esbarraria na regra `react-hooks/refs` do React Compiler.)
 */
export const captureSession = (): SessionCheck => sessionLifecycle.captureSession()

/** `true` só se a sessão foi capturada no `onMutate` e não houve login, logout ou expiração desde então. */
export function isSameSession(sameSession: SessionCheck | undefined): boolean {
  return sameSession?.() === true
}
