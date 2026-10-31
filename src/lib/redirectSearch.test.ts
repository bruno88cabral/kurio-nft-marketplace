import { describe, expect, it } from 'vitest'
import { validateRedirectSearch } from './redirectSearch'

describe('validateRedirectSearch', () => {
  it('aceita caminhos internos (com search e hash)', () => {
    expect(validateRedirectSearch({ redirect: '/nfts/nft-001?edition=1%2F10#x' })).toEqual({
      redirect: '/nfts/nft-001?edition=1%2F10#x',
    })
    expect(validateRedirectSearch({ redirect: '/' })).toEqual({ redirect: '/' })
  })

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'nfts/nft-001',
    ' /nfts',
    '/\t/evil.example',
    '/\n/evil.example',
    '/\r/evil.example',
    '/nfts\u0000',
    '/nfts\u007F',
    '',
  ])('descarta %j', (redirect) => {
    expect(validateRedirectSearch({ redirect })).toEqual({ redirect: undefined })
  })

  it('descarta valor que não é texto', () => {
    expect(validateRedirectSearch({ redirect: 42 })).toEqual({ redirect: undefined })
    expect(validateRedirectSearch({})).toEqual({ redirect: undefined })
  })

  it('devolve a chave mesmo inválida (o router mescla o search cru com o validado)', () => {
    expect(Object.keys(validateRedirectSearch({ redirect: 42 }))).toEqual(['redirect'])
    expect(Object.keys(validateRedirectSearch({ redirect: '//evil.example' }))).toEqual(['redirect'])
  })
})
