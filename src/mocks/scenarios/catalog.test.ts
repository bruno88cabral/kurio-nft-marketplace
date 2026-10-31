import { describe, expect, it } from 'vitest'
import { isApiErrorBody } from '@/contracts'
import { getScenario, isScenarioName, SCENARIO_NAMES, SCENARIOS } from '.'

describe('catálogo de cenários', () => {
  it('tem os 16 cenários, cada um com o próprio nome', () => {
    expect(SCENARIO_NAMES).toHaveLength(16)
    for (const name of SCENARIO_NAMES) expect(SCENARIOS[name].name).toBe(name)
  })

  it('getScenario cai no default para nomes desconhecidos', () => {
    expect(getScenario('nope').name).toBe('default')
    expect(getScenario(null).name).toBe('default')
    expect(getScenario('slow').name).toBe('slow')
    expect(isScenarioName('jitter')).toBe(true)
    expect(isScenarioName('x')).toBe(false)
  })

  it('latências respeitam o timeout de 10s, exceto o order-timeout', () => {
    for (const s of Object.values(SCENARIOS)) {
      const max = s.latency.kind === 'fixed' ? s.latency.ms : s.latency.maxMs
      expect(max).toBeLessThan(10_000)
    }
    expect(SCENARIOS['order-timeout'].routeLatency?.[0]?.ms).toBeGreaterThan(10_000)
  })

  it('corpos de erro são ApiErrorBody', () => {
    for (const s of Object.values(SCENARIOS)) {
      for (const f of s.failures ?? []) {
        if (f.respond !== 'offline') expect(isApiErrorBody(f.respond.body)).toBe(true)
      }
    }
  })
})
