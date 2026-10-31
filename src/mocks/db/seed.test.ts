import { describe, expect, it } from 'vitest'
import { NFTS } from '../fixtures/nfts'
import { getScenario } from '../scenarios'
import { seed } from './seed'

const defaultScenario = getScenario('default')

describe('seed', () => {
  it('é estável entre chamadas e não compartilha referências', () => {
    const a = seed(defaultScenario)
    const b = seed(defaultScenario)
    expect(a).toEqual(b)
    a.nfts['nft-001'].price = '99' as never
    expect(seed(defaultScenario).nfts['nft-001'].price).not.toBe('99')
  })

  it('cria usuários, carteiras e ~30 NFTs com IDs determinísticos', () => {
    const db = seed(defaultScenario)
    expect(Object.keys(db.users)).toEqual(['user-ana', 'user-bruno'])
    expect(Object.keys(db.nfts)).toHaveLength(30)
    expect(db.nfts['nft-001']?.id).toBe('nft-001')
    expect(db.wallets['user-ana']).toHaveLength(1)
    expect(db.versions).toEqual({})
  })

  it('cobre as 4 redes, as 4 edições, esgotados e destaques', () => {
    const nfts = [...NFTS]
    expect(new Set(nfts.map((n) => n.network))).toEqual(
      new Set(['ethereum', 'polygon', 'arbitrum', 'optimism']),
    )
    expect(new Set(nfts.flatMap((n) => n.editions.map((e) => e.kind)))).toEqual(
      new Set(['1/1', '1/10', '1/50', 'open']),
    )
    expect(new Set(nfts.map((n) => n.collection)).size).toBe(5)
    expect(nfts.some((n) => n.editions.every((e) => e.available === 0))).toBe(true)
    expect(nfts.some((n) => n.featured)).toBe(true)
    expect(new Set(nfts.map((n) => n.createdAt)).size).toBeGreaterThan(10)
    expect(nfts.every((n) => n.editions.every((e) => e.available <= e.total))).toBe(true)
  })

  it('cenário empty não cria NFTs nem favoritos', () => {
    const db = seed(getScenario('empty'))
    expect(db.nfts).toEqual({})
    expect(db.favorites['user-ana']).toEqual([])
    expect(Object.keys(db.users)).toHaveLength(2)
  })
})
