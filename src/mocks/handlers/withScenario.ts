import { HttpResponse, type HttpResponseResolver } from 'msw'
import { API_URL } from '@/app/env'
import type { ApiErrorBody } from '@/contracts'
import { scenario } from '../runtime'
import { RaisedResponse } from './errors'
import { createScenarioEngine } from '../scenarios/engine'

const engine = createScenarioEngine(scenario)

const apiBase = (() => {
  try {
    return new URL(API_URL, 'http://localhost').pathname.replace(/\/$/, '')
  } catch {
    return ''
  }
})()

export interface WithScenarioOptions {
  /**
   * Passa a aplicar a latência DEPOIS do resolver (o efeito colateral acontece primeiro). A latência
   * longa de `routeLatency` só vale quando este predicado aprova a resposta (ex.: `POST /orders` que
   * CRIOU o pedido, 201); as demais respostas (replay 200, erros de domínio) usam a latência base.
   * Assim o retry do `order-timeout` com a mesma chave volta dentro do timeout do cliente.
   */
  slowRouteLatencyWhen?: (response: Response) => boolean
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Envolve o resolver de um endpoint com o cenário ativo: (1) espera a latência, (2) aplica a falha
 * casada (`offline` vira erro de rede, o resto é JSON no formato `ApiErrorBody`), (3) chama o resolver.
 * `method`/`path` são os mesmos do `http.<verbo>` sem `API_URL` (ex.: `'PUT', '/favorites/:nftId'`).
 * Uma `Response` lançada pelo resolver (`apiError`, `requireSession`) vira a resposta.
 */
export function withScenario<R extends HttpResponseResolver>(
  method: string,
  path: string,
  resolver: R,
  options: WithScenarioOptions = {},
): R {
  const wrapped: HttpResponseResolver = async (info) => {
    const { pathname } = new URL(info.request.url)
    const relative = apiBase && pathname.startsWith(apiBase) ? pathname.slice(apiBase.length) || '/' : pathname

    const deferred = options.slowRouteLatencyWhen
    const ms = engine.latencyFor(method, path, relative)
    // Padrão: a latência vem antes do resolver. No modo diferido o efeito colateral acontece primeiro
    // e só a resposta atrasa (a falha do cenário, quando existe, continua impedindo o efeito)
    if (!deferred) await sleep(ms)

    const failure = engine.failureFor(method, path, relative)
    if (failure) {
      if (deferred) await sleep(ms)
      if (failure === 'offline') return HttpResponse.error()
      return HttpResponse.json<ApiErrorBody>(failure.body, { status: failure.status })
    }

    let response: Awaited<ReturnType<HttpResponseResolver>>
    try {
      response = await resolver(info)
    } catch (thrown) {
      if (!(thrown instanceof RaisedResponse)) throw thrown
      response = thrown.response
    }
    if (deferred) {
      const slow = response instanceof Response && deferred(response)
      await sleep(slow || !engine.hasRouteLatency(method, path, relative) ? ms : engine.baseLatency())
    }
    return response
  }
  return wrapped as R
}
