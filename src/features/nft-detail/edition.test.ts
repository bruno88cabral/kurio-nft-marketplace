import { describe, expect, it } from 'vitest'
import type { NftEdition } from '@/contracts'
import { clampEditionQuantity, defaultEdition, isEditionKind, resolveEdition } from './edition'

const ed = (kind: NftEdition['kind'], available: number): NftEdition => ({ kind, available, total: 50 })

describe('isEditionKind', () => {
  it('aceita só os tipos do contrato', () => {
    expect(isEditionKind('1/10')).toBe(true)
    expect(isEditionKind('open')).toBe(true)
    expect(isEditionKind('ABERTA')).toBe(false)
    expect(isEditionKind(10)).toBe(false)
    expect(isEditionKind(undefined)).toBe(false)
  })
})

describe('defaultEdition', () => {
  it('é a primeira edição com unidade, na ordem da UI (1/1, 1/10, 1/50, ABERTA)', () => {
    expect(defaultEdition({ editions: [ed('open', 5), ed('1/10', 0), ed('1/50', 8)] })?.kind).toBe('1/50')
  })

  it('não existe quando tudo está esgotado', () => {
    expect(defaultEdition({ editions: [ed('1/1', 0)] })).toBeUndefined()
    expect(defaultEdition({ editions: [] })).toBeUndefined()
  })
})

describe('resolveEdition', () => {
  const nft = { editions: [ed('1/10', 0), ed('1/50', 8), ed('open', 300)] }

  it('sem pedido: o padrão, sem aviso', () => {
    expect(resolveEdition(nft, undefined)).toEqual({ edition: ed('1/50', 8), unavailable: false })
  })

  it('pedido disponível: a própria edição', () => {
    expect(resolveEdition(nft, 'open')).toEqual({ edition: ed('open', 300), unavailable: false })
  })

  it('pedido esgotado: cai no padrão com aviso', () => {
    expect(resolveEdition(nft, '1/10')).toEqual({ edition: ed('1/50', 8), unavailable: true })
  })

  it('pedido que o NFT não tem: cai no padrão com aviso', () => {
    expect(resolveEdition(nft, '1/1')).toEqual({ edition: ed('1/50', 8), unavailable: true })
  })

  it('tudo esgotado: sem edição', () => {
    expect(resolveEdition({ editions: [ed('1/1', 0)] }, '1/1')).toEqual({ edition: undefined, unavailable: true })
    expect(resolveEdition({ editions: [ed('1/1', 0)] }, undefined)).toEqual({ edition: undefined, unavailable: false })
  })
})

describe('clampEditionQuantity', () => {
  it('limita entre 1 e o available da edição', () => {
    expect(clampEditionQuantity(ed('1/50', 8), 3)).toBe(3)
    expect(clampEditionQuantity(ed('1/50', 8), 20)).toBe(8)
    expect(clampEditionQuantity(ed('1/50', 8), 0)).toBe(1)
    expect(clampEditionQuantity(ed('1/50', 8), 2.7)).toBe(2)
  })

  it('sem edição (esgotado) fica em 1', () => {
    expect(clampEditionQuantity(undefined, 5)).toBe(1)
  })
})
