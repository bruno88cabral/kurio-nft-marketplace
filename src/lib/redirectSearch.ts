export interface RedirectSearch {
  redirect?: string
}

export function validateRedirectSearch(search: Record<string, unknown>): RedirectSearch {
  return typeof search.redirect === 'string' ? { redirect: search.redirect } : {}
}
