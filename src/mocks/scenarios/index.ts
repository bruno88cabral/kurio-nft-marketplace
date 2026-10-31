import { SCENARIOS, SCENARIO_NAMES, type Scenario, type ScenarioName } from './catalog'

export * from './catalog'
export { mulberry32 } from './prng'

export const DEFAULT_SCENARIO: ScenarioName = 'default'

export function isScenarioName(value: unknown): value is ScenarioName {
  return typeof value === 'string' && (SCENARIO_NAMES as readonly string[]).includes(value)
}

/** Nome desconhecido (ou ausente) cai no `default`. */
export function getScenario(name: string | null | undefined): Scenario {
  return isScenarioName(name) ? SCENARIOS[name] : SCENARIOS[DEFAULT_SCENARIO]
}
