export interface RedirectSearch {
  redirect?: string
}

// eslint-disable-next-line no-control-regex -- é exatamente o que se quer barrar
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/
const PROBE_ORIGIN = 'http://kurio.invalid'

/**
 * Só caminho interno do app: começa com `/`, mas não com `//` nem `/\` (que o navegador trata
 * como URL protocol-relative, ex.: `//evil.example`). URL absoluta, `javascript:` e caminho
 * relativo são descartados (MYK-1061, open redirect após o login).
 * Caracteres de controle também: o parser WHATWG remove TAB/LF/CR antes de interpretar, então
 * `/\t/evil.example` viraria `//evil.example`. Defesa em profundidade: resolvido contra uma
 * origem fixa, o resultado tem que continuar nela (não depende de `window`).
 */
export function isInternalPath(value: string): boolean {
  if (!value.startsWith('/') || value[1] === '/' || value[1] === '\\') return false
  if (CONTROL_CHARS.test(value)) return false
  try {
    return new URL(value, PROBE_ORIGIN).origin === PROBE_ORIGIN
  } catch {
    return false
  }
}

/**
 * `validateSearch` de `/login` e `/signup`. Valor inválido vira `undefined`, mas a chave sempre
 * volta: o TanStack Router mescla o search cru com o validado, e uma chave omitida deixaria o
 * valor cru passar.
 */
export function validateRedirectSearch(search: Record<string, unknown>): RedirectSearch {
  const raw = search.redirect
  return { redirect: typeof raw === 'string' && isInternalPath(raw) ? raw : undefined }
}
