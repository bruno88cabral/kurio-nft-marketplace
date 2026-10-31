export interface RedirectSearch {
  redirect?: string
}

/**
 * Só caminho interno do app: começa com `/`, mas não com `//` nem `/\` (que o navegador trata
 * como URL protocol-relative, ex.: `//evil.example`). URL absoluta, `javascript:` e caminho
 * relativo são descartados (MYK-1061, open redirect após o login).
 */
export function isInternalPath(value: string): boolean {
  return value.startsWith('/') && value[1] !== '/' && value[1] !== '\\'
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
