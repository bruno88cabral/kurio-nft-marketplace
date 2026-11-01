/** Auxiliares compartilhados pelos testes de rota de entrada (`-login.test.tsx`, `-signup.test.tsx`). */
import type { ReactNode } from 'react'
import { SESSION_STORAGE_KEY } from '@/auth/sessionStorage'

/** Substitui o `AuthDialog` real (que traz o fundo do Início): só expõe o `mode` e o `redirect`. */
export function AuthDialogStub({ mode, redirect, children }: { mode: 'login' | 'signup'; redirect?: string; children: ReactNode }) {
  return (
    <section aria-label="dialogo" data-mode={mode} data-redirect={redirect ?? ''}>
      {children}
    </section>
  )
}

/** Grava uma sessão válida no `localStorage`. */
export function guardarSessao(): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString() }))
}

/** O que `fn` lança (ex.: o `redirect` do `beforeLoad`), ou `undefined` se não lançar. */
export function thrownBy(fn: () => void): unknown {
  try {
    fn()
  } catch (error) {
    return error
  }
  return undefined
}
