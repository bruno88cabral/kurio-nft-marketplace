import { describe, expect, it } from 'vitest'
import type { Nft } from '@/contracts'
import { parseEth } from '@/lib/eth'
import { NFTS } from '../fixtures/nfts'
import { filterNfts, paginate, sortNfts } from './nftQuery'

function nft(id: string, over: Partial<Nft> = {}): Nft {
  return {
    id,
    name: id,
    imageUrl: '',
    collection: 'Alpha',
    description: '',
    creator: 'someone',
    network: 'ethereum',
    price: parseEth('1'),
    editions: [{ kind: '1/10', available: 10, total: 10 }],
    createdAt: '2026-10-01T00:00:00.000Z',
    featured: false,
    ...over,
  }
}

const ids = (list: Nft[]) => list.map((n) => n.id)

describe('filterNfts', () => {
  const list = [
    nft('a', { name: 'Aurora Prime', collection: 'Alpha', network: 'ethereum' }),
    nft('b', { name: 'Coral', collection: 'Beta', network: 'polygon', creator: 'Reef Lab' }),
    nft('c', { name: 'Atlas', collection: 'Beta', network: 'polygon', description: 'neon grid' }),
  ]

  it('q busca em nome, coleção, criador e descrição sem diferenciar caixa', () => {
    expect(ids(filterNfts(list, { q: 'AURORA' }))).toEqual(['a'])
    expect(ids(filterNfts(list, { q: 'reef' }))).toEqual(['b'])
    expect(ids(filterNfts(list, { q: 'neon' }))).toEqual(['c'])
  })

  it('collections e network filtram por igualdade', () => {
    expect(ids(filterNfts(list, { collections: ['beta'] }))).toEqual(['b', 'c'])
    expect(ids(filterNfts(list, { network: 'polygon', collections: ['Alpha', 'Beta'] }))).toEqual(['b', 'c'])
    expect(filterNfts(list, { network: 'arbitrum' })).toEqual([])
  })

  it('priceMin/priceMax comparam como decimal, inclusive nas bordas, sem perder precisão', () => {
    const prices = [
      nft('p1', { price: parseEth('0.123456789012345678') }),
      nft('p2', { price: parseEth('0.123456789012345679') }),
      nft('p3', { price: parseEth('0.1234567890123456781') }),
    ]
    expect(ids(filterNfts(prices, { priceMin: parseEth('0.123456789012345679') }))).toEqual(['p2'])
    expect(ids(filterNfts(prices, { priceMax: parseEth('0.123456789012345678') }))).toEqual(['p1'])
    expect(
      ids(filterNfts(prices, { priceMin: parseEth('0.123456789012345678'), priceMax: parseEth('0.1234567890123456781') })),
    ).toEqual(['p1', 'p3'])
  })

  it('tab=new usa a janela a partir do NFT mais recente', () => {
    const dated = [
      nft('n1', { createdAt: '2026-10-01T00:00:00.000Z' }),
      nft('n2', { createdAt: '2026-09-20T00:00:00.000Z' }),
      nft('n3', { createdAt: '2026-09-10T00:00:00.000Z' }),
    ]
    expect(ids(filterNfts(dated, { tab: 'new' }))).toEqual(['n1', 'n2'])
    expect(ids(filterNfts(dated, { tab: 'all' }))).toEqual(['n1', 'n2', 'n3'])
  })

  it('tab=trending pega os mais vendidos que ainda têm estoque', () => {
    const sales = [
      nft('t1', { editions: [{ kind: '1/10', available: 2, total: 10 }] }),
      nft('t2', { editions: [{ kind: '1/10', available: 8, total: 10 }] }),
      nft('t3', { editions: [{ kind: '1/10', available: 0, total: 10 }] }),
      nft('t4', { editions: [{ kind: '1/10', available: 5, total: 10 }, { kind: 'open', available: 1000, total: 1000 }] }),
    ]
    expect(ids(filterNfts(sales, { tab: 'trending' }))).toEqual(['t1', 't4'])
  })

  it('funciona com o seed completo', () => {
    expect(filterNfts(NFTS, {})).toHaveLength(NFTS.length)
    expect(filterNfts(NFTS, { tab: 'trending' }).length).toBeGreaterThan(0)
    expect(filterNfts(NFTS, { tab: 'new' }).length).toBeGreaterThan(0)
  })
})

describe('sortNfts', () => {
  const list = [
    nft('a', { price: parseEth('0.10'), createdAt: '2026-10-01T00:00:00.000Z' }),
    nft('b', { price: parseEth('0.9'), createdAt: '2026-10-03T00:00:00.000Z' }),
    nft('c', { price: parseEth('0.9'), createdAt: '2026-10-02T00:00:00.000Z' }),
  ]

  it('ordena por preço com big.js e desempata por id', () => {
    expect(ids(sortNfts(list, 'price_asc'))).toEqual(['a', 'b', 'c'])
    expect(ids(sortNfts(list, 'price_desc'))).toEqual(['b', 'c', 'a'])
  })

  it('newest é o padrão e não altera a entrada', () => {
    const copy = [...list]
    expect(ids(sortNfts(list))).toEqual(['b', 'c', 'a'])
    expect(list).toEqual(copy)
  })
})

describe('paginate', () => {
  const items = [1, 2, 3, 4, 5]

  it('devolve a página pedida', () => {
    expect(paginate(items, 2, 2)).toEqual({ items: [3, 4], page: 2, pageSize: 2, total: 5 })
    expect(paginate(items, 3, 2).items).toEqual([5])
  })

  it('página fora do intervalo vem vazia com o total correto', () => {
    expect(paginate(items, 9, 2)).toEqual({ items: [], page: 9, pageSize: 2, total: 5 })
    expect(paginate([], 1, 12)).toEqual({ items: [], page: 1, pageSize: 12, total: 0 })
  })
})
