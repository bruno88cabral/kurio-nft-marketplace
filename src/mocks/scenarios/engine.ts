import { mulberry32 } from './prng'
import type { Scenario, ScenarioFailure } from './catalog'

/** Converte um padrão MSW (`/favorites/:nftId`, `*`) em RegExp sobre o pathname sem `API_URL`. */
function patternToRegExp(pattern: string): RegExp {
  const source = pattern
    .split('/')
    .map((part) => {
      if (part.startsWith(':')) return '[^/]+'
      return part.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    })
    .join('/')
  return new RegExp(`^${source}/?$`)
}

export function matchPath(pattern: string, handlerPath: string, pathname: string): boolean {
  if (pattern === '*' || pattern === handlerPath) return true
  return patternToRegExp(pattern).test(pathname)
}

function matchMethod(rule: string, method: string): boolean {
  return rule === '*' || rule.toUpperCase() === method.toUpperCase()
}

export interface ScenarioEngine {
  /** Latência (ms) da requisição: `routeLatency` da rota, senão a base do cenário (fixa ou PRNG). */
  latencyFor: (method: string, handlerPath: string, pathname: string) => number
  /** Latência base do cenário (fixa ou próximo sorteio do PRNG), ignorando `routeLatency`. */
  baseLatency: () => number
  /** A rota tem `routeLatency` própria? */
  hasRouteLatency: (method: string, handlerPath: string, pathname: string) => boolean
  /** Falha a aplicar, se alguma casar e já tiver passado do `afterRequests`. Conta a requisição casada. */
  failureFor: (method: string, handlerPath: string, pathname: string) => ScenarioFailure['respond'] | null
}

/** Estado do cenário durante a vida da página: PRNG da latência e contadores de `afterRequests`. */
export function createScenarioEngine(scenario: Scenario): ScenarioEngine {
  const { latency } = scenario
  const random = latency.kind === 'random' ? mulberry32(latency.seed) : null
  const seen = new Map<ScenarioFailure, number>()

  const routeOf = (method: string, handlerPath: string, pathname: string) =>
    scenario.routeLatency?.find((r) => matchMethod(r.method, method) && matchPath(r.path, handlerPath, pathname))
  const baseLatency = () => {
    if (latency.kind === 'fixed') return latency.ms
    const draw = random ? random() : 0
    return Math.round(latency.minMs + draw * (latency.maxMs - latency.minMs))
  }

  return {
    baseLatency,
    hasRouteLatency: (method, handlerPath, pathname) => routeOf(method, handlerPath, pathname) !== undefined,
    latencyFor(method, handlerPath, pathname) {
      return routeOf(method, handlerPath, pathname)?.ms ?? baseLatency()
    },
    failureFor(method, handlerPath, pathname) {
      for (const failure of scenario.failures ?? []) {
        if (!matchMethod(failure.method, method) || !matchPath(failure.path, handlerPath, pathname)) continue
        const count = seen.get(failure) ?? 0
        seen.set(failure, count + 1)
        if (count >= (failure.afterRequests ?? 0)) return failure.respond
      }
      return null
    },
  }
}
