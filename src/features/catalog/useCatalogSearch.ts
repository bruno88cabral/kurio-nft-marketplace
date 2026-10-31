import { getRouteApi } from '@tanstack/react-router'
import { useCallback } from 'react'
import { withFilter, type CatalogFilterPatch } from '@/lib/catalogSearch'

const homeRoute = getRouteApi('/')

/**
 * Estado do catálogo lido da URL da rota `/` e a única forma de mudá-lo: toda mudança de busca,
 * filtro, aba ou ordenação passa por `withFilter` (volta à página 1) e vira uma entrada no
 * histórico, então voltar/avançar restaura o estado. `resetScroll: false` mantém a posição.
 */
export function useCatalogSearch() {
  const search = homeRoute.useSearch()
  const navigate = homeRoute.useNavigate()
  const update = useCallback(
    (patch: CatalogFilterPatch) => void navigate({ search: (prev) => withFilter(prev, patch), resetScroll: false }),
    [navigate],
  )
  return { search, update }
}
