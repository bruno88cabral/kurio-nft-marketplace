import { describe, expect, it } from 'vitest'
import {
  CATALOG_PAGE_SIZE,
  activeFilterCount,
  pageCount,
  pageItems,
  toListParams,
  validateCatalogSearch,
  withFilter,
  type CatalogSearch,
} from './catalogSearch'
import { parseEth } from './eth'

describe('validateCatalogSearch', () => {
  it('mantém uma busca completa e válida (round-trip)', () => {
    const search: CatalogSearch = {
      q: 'aurora',
      collections: ['Aurora Drift', 'Neon Atlas'],
      priceMin: parseEth('0.1'),
      priceMax: parseEth('2.5'),
      network: 'polygon',
      tab: 'trending',
      sort: 'price_desc',
      page: 3,
    }
    expect(validateCatalogSearch({ ...search })).toEqual(search)
    expect(validateCatalogSearch(validateCatalogSearch({ ...search }) as Record<string, unknown>)).toEqual(search)
  })

  it('URL vazia vira busca vazia (os padrões ficam fora da URL)', () => {
    expect(validateCatalogSearch({})).toEqual({})
  })

  it('descarta os valores padrão: tab all, sort newest e page 1', () => {
    expect(validateCatalogSearch({ tab: 'all', sort: 'newest', page: 1 })).toEqual({})
  })

  it('descarta valores inválidos sem lançar', () => {
    expect(
      validateCatalogSearch({
        q: '   ',
        collections: [3, ''],
        priceMin: 'abc',
        priceMax: -1,
        network: 'solana',
        tab: 'hot',
        sort: 'random',
        page: 0,
        pageSize: 50,
        extra: 'x',
      }),
    ).toEqual({})
    expect(validateCatalogSearch({ page: 2.5 })).toEqual({})
    expect(validateCatalogSearch({ page: '-3' })).toEqual({})
    expect(validateCatalogSearch({ priceMin: '1e-7' })).toEqual({})
    expect(validateCatalogSearch({ q: 42 })).toEqual({})
  })

  it('devolve toda chave conhecida, mesmo undefined (o router mescla a busca crua com a validada)', () => {
    const raw = { page: 'abc', tab: 'hot', priceMin: 'x', network: 'solana', sort: 'random', q: '', collections: 3 }
    const validated = validateCatalogSearch(raw)
    const merged: Record<string, unknown> = { ...raw, ...validated }
    for (const key of ['q', 'collections', 'priceMin', 'priceMax', 'network', 'tab', 'sort', 'page']) {
      expect(key in validated).toBe(true)
      expect(merged[key]).toBeUndefined()
    }
    expect(toListParams(merged as CatalogSearch)).toEqual({ page: 1, pageSize: CATALOG_PAGE_SIZE })
  })

  it('aceita page e preço como número (parse padrão do router) ou texto', () => {
    expect(validateCatalogSearch({ page: 2, priceMin: 0.5, priceMax: '3' })).toEqual({
      page: 2,
      priceMin: '0.5',
      priceMax: '3',
    })
    expect(validateCatalogSearch({ page: '4' })).toEqual({ page: 4 })
  })

  it('descarta a faixa de preço invertida', () => {
    expect(validateCatalogSearch({ priceMin: '3', priceMax: '1' })).toEqual({})
    expect(validateCatalogSearch({ priceMin: '1', priceMax: '1' })).toEqual({ priceMin: '1', priceMax: '1' })
  })

  it('normaliza collections: ordenado, sem duplicata, aceita texto separado por vírgula', () => {
    expect(validateCatalogSearch({ collections: ['Neon Atlas', 'Aurora Drift', 'Neon Atlas'] })).toEqual({
      collections: ['Aurora Drift', 'Neon Atlas'],
    })
    expect(validateCatalogSearch({ collections: 'Pixel Reefs, Aurora Drift' })).toEqual({
      collections: ['Aurora Drift', 'Pixel Reefs'],
    })
    expect(validateCatalogSearch({ collections: [] })).toEqual({})
  })

  it('apara o texto da busca', () => {
    expect(validateCatalogSearch({ q: '  coral  ' })).toEqual({ q: 'coral' })
  })
})

describe('toListParams', () => {
  it('fixa page 1 e o pageSize do catálogo quando a URL está vazia', () => {
    expect(toListParams({})).toEqual({ page: 1, pageSize: CATALOG_PAGE_SIZE })
  })

  it('repassa os filtros sem chaves undefined', () => {
    const params = toListParams({ q: 'x', collections: ['A'], network: 'ethereum', tab: 'new', sort: 'price_asc', page: 2 })
    expect(params).toEqual({
      q: 'x',
      collections: ['A'],
      network: 'ethereum',
      tab: 'new',
      sort: 'price_asc',
      page: 2,
      pageSize: CATALOG_PAGE_SIZE,
    })
    expect(Object.values(params).includes(undefined)).toBe(false)
  })

  it('a mesma seleção em ordens diferentes gera os mesmos parâmetros (mesma chave de query)', () => {
    const a = toListParams(validateCatalogSearch({ collections: ['B', 'A'] }))
    const b = toListParams(validateCatalogSearch({ collections: ['A', 'B', 'A'] }))
    expect(a).toEqual(b)
  })
})

describe('withFilter', () => {
  it('aplica o patch e volta para a página 1', () => {
    expect(withFilter({ tab: 'new', page: 4 }, { network: 'polygon' })).toEqual({ tab: 'new', network: 'polygon' })
  })

  it('patch com undefined remove o filtro', () => {
    expect(withFilter({ q: 'x', network: 'polygon', page: 2 }, { q: undefined })).toEqual({ network: 'polygon' })
  })

  it('normaliza o resultado (collections ordenado, padrão fora da URL)', () => {
    expect(withFilter({ page: 2 }, { collections: ['Z', 'A'], sort: 'newest', tab: 'all' })).toEqual({
      collections: ['A', 'Z'],
    })
  })
})

describe('activeFilterCount', () => {
  it('conta coleções, rede e faixa de preço (busca, aba e ordenação não são filtros da sidebar)', () => {
    expect(activeFilterCount({})).toBe(0)
    expect(activeFilterCount({ q: 'x', tab: 'new', sort: 'price_asc', page: 2 })).toBe(0)
    expect(
      activeFilterCount({ collections: ['A', 'B'], network: 'polygon', priceMin: parseEth('1') }),
    ).toBe(4)
  })
})

describe('paginação', () => {
  it('pageCount: no mínimo 1 página', () => {
    expect(pageCount(0, 9)).toBe(1)
    expect(pageCount(30, 9)).toBe(4)
    expect(pageCount(30, 12)).toBe(3)
    expect(pageCount(24, 12)).toBe(2)
  })

  it('pageItems: todas as páginas quando são poucas', () => {
    expect(pageItems(1, 4)).toEqual([1, 2, 3, 4])
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('pageItems: reticências em volta da página atual quando são muitas', () => {
    expect(pageItems(1, 20)).toEqual([1, 2, 'ellipsis', 20])
    expect(pageItems(10, 20)).toEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 20])
    expect(pageItems(20, 20)).toEqual([1, 'ellipsis', 19, 20])
    expect(pageItems(4, 20)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 20])
  })
})
