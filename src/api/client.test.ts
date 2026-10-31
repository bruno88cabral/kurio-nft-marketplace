import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { isCancel } from 'axios'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/contracts/errors'
import { apiClient, onUnauthorized } from './client'

describe('apiClient: normalização de erros', () => {
  let server: http.Server
  let base: string

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      res.setHeader('content-type', 'application/json')
      if (req.url === '/body') {
        res.statusCode = 422
        res.end(JSON.stringify({ code: 'validation', message: 'inválido', fieldErrors: { email: 'obrigatório' } }))
      } else if (req.url === '/spa-fallback') {
        // o que o fallback da SPA (Vite/Vercel) devolve quando não há API atrás de /api
        res.setHeader('content-type', 'text/html')
        res.statusCode = 200
        res.end('<!doctype html><html><body><div id="root"></div></body></html>')
      } else if (req.url === '/echo-auth') {
        res.end(JSON.stringify({ authorization: req.headers.authorization ?? null }))
      } else if (req.url === '/unauthorized') {
        res.statusCode = 401
        res.end(JSON.stringify({ code: 'unauthorized', message: 'Sessão ausente ou expirada.' }))
      } else if (req.url === '/hang') {
        // nunca responde
      } else {
        res.statusCode = 404
        res.end('{}')
      }
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(() => {
    server.closeAllConnections()
    server.close()
  })

  it('sem resposta (porta fechada) rejeita com ApiError transient', async () => {
    const err = await apiClient.get('/nao-existe', { baseURL: 'http://127.0.0.1:1' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('transient')
    expect((err as ApiError).status).toBeUndefined()
  })

  it('timeout rejeita com ApiError transient', async () => {
    const err = await apiClient.get('/hang', { baseURL: base, timeout: 100 }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('transient')
  })

  it('usa o body no formato ApiErrorBody', async () => {
    const err = await apiClient.get('/body', { baseURL: base }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ code: 'validation', status: 422, fieldErrors: { email: 'obrigatório' } })
  })

  it('HTML com 200 (fallback da SPA, sem API) rejeita com ApiError transient', async () => {
    const err = await apiClient.get('/spa-fallback', { baseURL: base }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ code: 'transient', status: 200 })
  })

  it('body fora do contrato mapeia pelo status', async () => {
    const err = await apiClient.get('/outro', { baseURL: base }).catch((e: unknown) => e)
    expect(err).toMatchObject({ code: 'not_found', status: 404 })
  })

  it('cancelamento (AbortController) propaga o cancel e não vira ApiError', async () => {
    const controller = new AbortController()
    const pending = apiClient.get('/hang', { baseURL: base, signal: controller.signal }).catch((e: unknown) => e)
    controller.abort()
    const err = await pending
    expect(isCancel(err)).toBe(true)
    expect(err).not.toBeInstanceOf(ApiError)
  })

  it('signal já abortado antes do request também é cancelamento', async () => {
    const err = await apiClient
      .get('/hang', { baseURL: base, signal: AbortSignal.abort() })
      .catch((e: unknown) => e)
    expect(isCancel(err)).toBe(true)
    expect(err).not.toBeInstanceOf(ApiError)
  })

  describe('sessão', () => {
    const store = new Map<string, string>()
    const SESSION = JSON.stringify({ token: 'abc', expiresAt: '2999-01-01T00:00:00.000Z' })

    beforeEach(() => {
      store.clear()
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
      onUnauthorized(null)
    })

    it('com token na sessão envia Authorization: Bearer', async () => {
      store.set('kurio:session', SESSION)
      const { data } = await apiClient.get<{ authorization: string | null }>('/echo-auth', { baseURL: base })
      expect(data.authorization).toBe('Bearer abc')
    })

    it('sem token não envia Authorization', async () => {
      const { data } = await apiClient.get<{ authorization: string | null }>('/echo-auth', { baseURL: base })
      expect(data.authorization).toBeNull()
    })

    it('401 numa request que levou token limpa a sessão e chama onUnauthorized', async () => {
      store.set('kurio:session', SESSION)
      const cb = vi.fn()
      onUnauthorized(cb)
      const err = await apiClient.get('/unauthorized', { baseURL: base }).catch((e: unknown) => e)
      expect(err).toMatchObject({ code: 'unauthorized', status: 401 })
      expect(store.has('kurio:session')).toBe(false)
      expect(cb).toHaveBeenCalledTimes(1)
    })

    it('401 numa request sem token não chama onUnauthorized', async () => {
      const cb = vi.fn()
      onUnauthorized(cb)
      await apiClient.get('/unauthorized', { baseURL: base }).catch(() => undefined)
      expect(cb).not.toHaveBeenCalled()
    })
  })
})
