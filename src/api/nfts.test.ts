import { describe, expect, it } from 'vitest'
import { ApiError } from '@/contracts'
import { favoriteKeys } from './favorites'
import { nftDetailQuery, nftKeys, nftListQuery } from './nfts'

describe('nftKeys', () => {
  it('chaves estáveis e hierárquicas sob ["nfts"]', () => {
    expect(nftKeys.list({ page: 2 })).toEqual(['nfts', 'list', { page: 2 }])
    expect(nftKeys.detail('nft-001')).toEqual(['nfts', 'detail', 'nft-001'])
    expect(nftKeys.featured).toEqual(['nfts', 'featured'])
    expect(nftKeys.facets).toEqual(['nfts', 'facets'])
  })

  it('favoritos são isolados por conta', () => {
    expect(favoriteKeys.list('u1')).not.toEqual(favoriteKeys.list('u2'))
  })
})

describe('nftDetailQuery', () => {
  const retry = nftDetailQuery('x').retry as (count: number, error: Error) => boolean
  const notFound = new ApiError({ code: 'not_found', message: 'n' }, 404)
  const transient = new ApiError({ code: 'transient', message: 't' })

  it('não tenta de novo no 404', () => {
    expect(retry(0, notFound)).toBe(false)
  })

  it('tenta uma vez nos demais erros', () => {
    expect(retry(0, transient)).toBe(true)
    expect(retry(1, transient)).toBe(false)
  })
})

describe('nftListQuery', () => {
  it('mantém os dados anteriores durante a troca de parâmetros', () => {
    expect(nftListQuery({}).placeholderData).toBeTypeOf('function')
  })
})
