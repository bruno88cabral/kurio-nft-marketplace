import { describe, expect, it } from 'vitest'
import { resolveScenarioName } from '../runtime'
import { SCENARIOS } from './catalog'
import { createScenarioEngine, matchPath } from './engine'

describe('matchPath', () => {
  it('casa curinga, igualdade do padrão e parâmetros', () => {
    expect(matchPath('*', '/x', '/y')).toBe(true)
    expect(matchPath('/nfts/:nftId', '/nfts/:nftId', '/nfts/nft-001')).toBe(true)
    expect(matchPath('/nfts/:nftId', '/other', '/nfts/nft-001')).toBe(true)
    expect(matchPath('/nfts/:nftId', '/nfts/featured', '/nfts/a/b')).toBe(false)
    expect(matchPath('/favorites/*', '/x', '/favorites/nft-001')).toBe(true)
    expect(matchPath('/orders', '/orders/:id', '/orders/abc')).toBe(false)
  })
})

describe('createScenarioEngine', () => {
  it('latência fixa e routeLatency da rota', () => {
    const base = createScenarioEngine(SCENARIOS.default)
    expect(base.latencyFor('GET', '/nfts', '/nfts')).toBe(150)

    const timeout = createScenarioEngine(SCENARIOS['order-timeout'])
    expect(timeout.latencyFor('POST', '/orders', '/orders')).toBe(12_000)
    expect(timeout.latencyFor('GET', '/orders/:id', '/orders/1')).toBe(150)
  })

  it('jitter: mesma sequência em duas instâncias e sempre dentro de [min, max]', () => {
    const run = () => {
      const engine = createScenarioEngine(SCENARIOS.jitter)
      return Array.from({ length: 20 }, () => engine.latencyFor('GET', '/nfts', '/nfts'))
    }
    const a = run()
    expect(run()).toEqual(a)
    expect(new Set(a).size).toBeGreaterThan(5)
    for (const ms of a) {
      expect(ms).toBeGreaterThanOrEqual(300)
      expect(ms).toBeLessThanOrEqual(7_000)
    }
  })

  it('failures com curinga valem para qualquer método e rota', () => {
    expect(createScenarioEngine(SCENARIOS.offline).failureFor('DELETE', '/x', '/x')).toBe('offline')
    expect(createScenarioEngine(SCENARIOS['server-error']).failureFor('GET', '/health', '/health')).toMatchObject({
      status: 503,
    })
    expect(createScenarioEngine(SCENARIOS.default).failureFor('GET', '/nfts', '/nfts')).toBeNull()
  })

  it('favorite-fail só atinge PUT/DELETE de favoritos', () => {
    const engine = createScenarioEngine(SCENARIOS['favorite-fail'])
    expect(engine.failureFor('PUT', '/favorites/:nftId', '/favorites/nft-001')).toMatchObject({ status: 503 })
    expect(engine.failureFor('DELETE', '/favorites/:nftId', '/favorites/nft-001')).toMatchObject({ status: 503 })
    expect(engine.failureFor('GET', '/favorites', '/favorites')).toBeNull()
  })

  it('afterRequests deixa passar as primeiras requisições casadas', () => {
    const engine = createScenarioEngine({
      ...SCENARIOS.default,
      failures: [{ method: 'GET', path: '/nfts', respond: 'offline', afterRequests: 2 }],
    })
    const call = () => engine.failureFor('GET', '/nfts', '/nfts')
    expect([call(), call(), call(), call()]).toEqual([null, null, 'offline', 'offline'])
  })
})

describe('resolveScenarioName', () => {
  it('?scenario= válido vence o persistido; inválido ou ausente mantém o persistido; sem nada, default', () => {
    expect(resolveScenarioName('?scenario=empty', 'slow')).toEqual({ name: 'empty', changed: true })
    expect(resolveScenarioName('?scenario=nope', 'slow')).toEqual({ name: 'slow', changed: false })
    expect(resolveScenarioName('', 'slow')).toEqual({ name: 'slow', changed: false })
    expect(resolveScenarioName('', null)).toEqual({ name: 'default', changed: false })
    expect(resolveScenarioName('?scenario=default', null)).toEqual({ name: 'default', changed: false })
    expect(resolveScenarioName('?scenario=empty', 'empty')).toEqual({ name: 'empty', changed: false })
  })
})
