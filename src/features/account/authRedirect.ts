import { AUTH_ROUTES } from '@/auth/sessionLifecycle'
import { validateRedirectSearch } from '@/lib/redirectSearch'

const PROBE_ORIGIN = 'http://kurio.invalid'

export interface RedirectLocation {
  pathname: string
  href: string
  search: unknown
}

/**
 * `redirect` do link "Entrar" do visitante: o lugar atual, exceto em `/login` e `/signup`, onde se
 * preserva o `redirect` que já está lá (sem isso, `/login?redirect=/login?redirect=…`, MYK-1078).
 */
export function visitorLoginRedirect({ pathname, href, search }: RedirectLocation): string | undefined {
  if (!AUTH_ROUTES.includes(pathname)) return href
  const raw = typeof search === 'object' && search !== null ? (search as Record<string, unknown>) : {}
  return validateRedirectSearch(raw).redirect
}

/** Caminho (sem query/hash) de um `redirect` interno já validado. */
export function redirectPathname(redirect: string): string {
  return new URL(redirect, PROBE_ORIGIN).pathname
}

/**
 * Para onde fechar o modal (X, Esc, clique fora). É o `redirect`, mas um visitante que fecha o
 * login de uma rota protegida voltaria ao próprio login (a guarda manda de volta): vai para `/`.
 */
export function dialogCloseTarget(
  redirect: string | undefined,
  isAuthenticated: boolean,
  isProtected: (pathname: string) => boolean,
): string {
  if (!redirect) return '/'
  if (!isAuthenticated && isProtected(redirectPathname(redirect))) return '/'
  return redirect
}
