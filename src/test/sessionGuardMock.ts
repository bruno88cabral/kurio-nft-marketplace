/**
 * Mock de `@/auth/sessionGuard` com contador de geração, como o ciclo de vida real: `captureSession()` fixa a
 * geração NO MOMENTO da chamada e devolve `() => gen === capturada`. `bumpSession()` simula login/logout/troca
 * de conta. Uma captura feita tarde demais (ex.: no `onSuccess` em vez do `onMutate`) vê a geração já nova e
 * o teste de "sessão trocada" falha, o que um booleano lido na hora da checagem não detectaria.
 *
 * Uso:
 *   import { bumpSession } from '@/test/sessionGuardMock'
 *   vi.mock('@/auth/sessionGuard', async () => (await import('@/test/sessionGuardMock')).sessionGuardMock())
 * O `afterEach` volta a geração a 0 e zera `guardChecks()`.
 */
import { afterEach } from 'vitest'

let gen = 0
const results: boolean[] = []

export function bumpSession(): void {
  gen++
}

afterEach(() => {
  gen = 0
  results.length = 0
})

/** Resultado de cada `isSameSession` desde o início do teste: sinal positivo de que o `onSuccess`/`onError` rodou e consultou a guarda. */
export function guardChecks(): readonly boolean[] {
  return [...results]
}

export function sessionGuardMock() {
  return {
    captureSession: (): (() => boolean) => {
      const captured = gen
      return () => gen === captured
    },
    isSameSession: (check: (() => boolean) | undefined): boolean => {
      const same = check?.() === true
      results.push(same)
      return same
    },
  }
}
