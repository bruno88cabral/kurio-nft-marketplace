import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { ApiError, type Id, type Nft, type NftFacets, type NftListParams, type Paginated } from '@/contracts'
import { apiClient } from './client'

export const nftKeys = {
  all: ['nfts'] as const,
  list: (params: NftListParams) => ['nfts', 'list', params] as const,
  detail: (id: Id) => ['nfts', 'detail', id] as const,
  featured: ['nfts', 'featured'] as const,
  facets: ['nfts', 'facets'] as const,
}

/** `collections` sai repetido (`collections=a&collections=b`), formato que o handler aceita. */
const REPEAT_ARRAYS = { indexes: null } as const

export function nftListQuery(params: NftListParams) {
  return queryOptions({
    queryKey: nftKeys.list(params),
    queryFn: async ({ signal }) =>
      (await apiClient.get<Paginated<Nft>>('/nfts', { params, paramsSerializer: REPEAT_ARRAYS, signal })).data,
    placeholderData: keepPreviousData,
  })
}

export function nftDetailQuery(id: Id) {
  return queryOptions({
    queryKey: nftKeys.detail(id),
    queryFn: async ({ signal }) => (await apiClient.get<Nft>(`/nfts/${encodeURIComponent(id)}`, { signal })).data,
    // 404 não melhora tentando de novo
    retry: (count, error) => !(error instanceof ApiError && error.code === 'not_found') && count < 1,
  })
}

export function featuredNftsQuery() {
  return queryOptions({
    queryKey: nftKeys.featured,
    queryFn: async ({ signal }) => (await apiClient.get<Nft[]>('/nfts/featured', { signal })).data,
  })
}

export function nftFacetsQuery() {
  return queryOptions({
    queryKey: nftKeys.facets,
    queryFn: async ({ signal }) => (await apiClient.get<NftFacets>('/nfts/facets', { signal })).data,
  })
}
