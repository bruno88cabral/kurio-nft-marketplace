import { createStore, type MockStorage, type Store } from './db/store'
import { DEFAULT_SCENARIO, getScenario, isScenarioName, type Scenario, type ScenarioName } from './scenarios'

export const SCENARIO_STORAGE_KEY = 'kurio:mock-scenario'

/**
 * Escolhe o cenário: `?scenario=` válido vence o persistido, que vence o `default`.
 * `changed` indica que o cenário efetivo mudou em relação ao anterior (persistido ou `default`),
 * e portanto o db precisa voltar ao seed.
 */
export function resolveScenarioName(search: string, stored: string | null): { name: ScenarioName; changed: boolean } {
  const requested = new URLSearchParams(search).get('scenario')
  const previous = isScenarioName(stored) ? stored : DEFAULT_SCENARIO
  const name = isScenarioName(requested) ? requested : previous
  return { name, changed: name !== previous }
}

function memoryStorage(): MockStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
}

function browserStorage(): MockStorage {
  try {
    return typeof localStorage === 'undefined' ? memoryStorage() : localStorage
  } catch {
    return memoryStorage() // acesso ao localStorage bloqueado
  }
}

function init(): { store: Store; scenario: Scenario } {
  const storage = browserStorage()
  let stored: string | null = null
  try {
    stored = storage.getItem(SCENARIO_STORAGE_KEY)
  } catch {
    // storage indisponível: segue com o padrão
  }
  const search = typeof location === 'undefined' ? '' : location.search
  const { name, changed } = resolveScenarioName(search, stored)
  try {
    if (name !== stored) storage.setItem(SCENARIO_STORAGE_KEY, name)
  } catch {
    // idem
  }
  const scenario = getScenario(name)
  const store = createStore({ storage, scenario })
  // O seed depende do cenário (ex.: `empty`); trocar de cenário parte sempre de um estado limpo
  if (changed) store.reset()
  return { store, scenario }
}

const runtime = init()

/** Store único do mock, criado com o cenário escolhido na carga da página. */
export const store: Store = runtime.store
/** Cenário ativo durante toda a vida da página (trocar exige recarregar com `?scenario=`). */
export const scenario: Scenario = runtime.scenario
