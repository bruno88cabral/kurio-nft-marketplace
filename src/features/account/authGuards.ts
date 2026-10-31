import { redirect } from '@tanstack/react-router'
import { getToken } from '@/auth/sessionStorage'
import type { RedirectSearch } from '@/lib/redirectSearch'

/**
 * `beforeLoad` de `/login` e `/signup`: com sessão guardada, para onde ir no lugar do modal
 * (`redirect` ou `/`); sem sessão, `null`. A rota é quem lança o `redirect({ href })`.
 */
export function authenticatedDestination({ redirect: target }: RedirectSearch): string | null {
  return getToken() === null ? null : (target ?? '/')
}

/** Destino da guarda das rotas privadas: o login, voltando para onde a pessoa queria ir. */
export function toLogin(href: string) {
  return redirect({ to: '/login', search: { redirect: href }, replace: true })
}
