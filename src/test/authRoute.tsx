/** Auxiliares compartilhados pelos testes de rota de entrada (`-login.test.tsx`, `-signup.test.tsx`). */
import type { ReactNode } from 'react'
import { SESSION_STORAGE_KEY } from '@/auth/sessionStorage'

/** Substitui o `AuthDialog` real (que traz o fundo do Início): só expõe título, descrição e `redirect`. */
export function AuthDialogStub({ title, description, redirect, children }: { title: string; description: string; redirect?: string; children: ReactNode }) {
  return (
    <section aria-label="dialogo" data-redirect={redirect ?? ''}>
      <h1>{title}</h1>
      <p>{description}</p>
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
