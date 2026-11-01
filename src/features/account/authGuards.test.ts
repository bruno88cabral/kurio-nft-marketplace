// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { SESSION_STORAGE_KEY } from '@/auth/sessionStorage'
import { authenticatedDestination, toLogin } from './authGuards'

afterEach(() => localStorage.clear())

const guardar = (expiresAt: string) => localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', expiresAt }))
const FUTURO = new Date(Date.now() + 3_600_000).toISOString()

describe('authenticatedDestination', () => {
  it('sem sessão guardada devolve null', () => {
    expect(authenticatedDestination({ redirect: '/cart' })).toBeNull()
  })

  it('sessão expirada conta como sem sessão', () => {
    guardar(new Date(Date.now() - 1000).toISOString())
    expect(authenticatedDestination({})).toBeNull()
  })

  it('com sessão devolve o redirect', () => {
    guardar(FUTURO)
    expect(authenticatedDestination({ redirect: '/cart' })).toBe('/cart')
  })

  it('com sessão e sem redirect devolve /', () => {
    guardar(FUTURO)
    expect(authenticatedDestination({})).toBe('/')
  })
})

describe('toLogin', () => {
  it('monta o redirect para /login levando o href atual', () => {
    const r = toLogin('/profile?tab=1')
    expect(r.options).toMatchObject({ to: '/login', search: { redirect: '/profile?tab=1' }, replace: true })
  })
})
