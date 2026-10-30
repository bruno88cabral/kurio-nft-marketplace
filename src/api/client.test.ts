import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ApiError } from '@/contracts/errors'
import { apiClient } from './client'

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
})
