import { describe, expect, it } from 'vitest'
import { dialogCloseTarget, redirectPathname, visitorLoginRedirect } from './authRedirect'

describe('visitorLoginRedirect', () => {
  it('fora das telas de entrada, é o href atual', () => {
    expect(visitorLoginRedirect({ pathname: '/nfts/nft-001', href: '/nfts/nft-001?x=1', search: { x: 1 } })).toBe(
      '/nfts/nft-001?x=1',
    )
  })

  it('em /login e /signup preserva o redirect atual (sem encadear)', () => {
    const search = { redirect: '/profile' }
    expect(visitorLoginRedirect({ pathname: '/login', href: '/login?redirect=%2Fprofile', search })).toBe('/profile')
    expect(visitorLoginRedirect({ pathname: '/signup', href: '/signup?redirect=%2Fprofile', search })).toBe('/profile')
  })

  it('em /login sem redirect (ou com um inválido) não manda redirect', () => {
    expect(visitorLoginRedirect({ pathname: '/login', href: '/login', search: {} })).toBeUndefined()
    expect(
      visitorLoginRedirect({ pathname: '/login', href: '/login', search: { redirect: '//evil.example' } }),
    ).toBeUndefined()
    expect(visitorLoginRedirect({ pathname: '/login', href: '/login', search: undefined })).toBeUndefined()
  })
})

describe('redirectPathname', () => {
  it('tira query e hash', () => {
    expect(redirectPathname('/profile?tab=1#x')).toBe('/profile')
  })
})

describe('dialogCloseTarget', () => {
  const isProtected = (pathname: string) => pathname === '/profile'

  it('sem redirect vai para /', () => {
    expect(dialogCloseTarget(undefined, false, isProtected)).toBe('/')
  })

  it('volta ao redirect público', () => {
    expect(dialogCloseTarget('/nfts/nft-001', false, isProtected)).toBe('/nfts/nft-001')
  })

  it('visitante fechando o login de uma rota protegida vai para /', () => {
    expect(dialogCloseTarget('/profile?a=1', false, isProtected)).toBe('/')
  })

  it('logado volta ao redirect protegido', () => {
    expect(dialogCloseTarget('/profile', true, isProtected)).toBe('/profile')
  })
})
