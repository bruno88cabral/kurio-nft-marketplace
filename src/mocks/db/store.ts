import type { Id } from '@/contracts'
import type { Scenario } from '../scenarios'
import { createBus, type Bus } from './bus'
import { DB_COLLECTIONS, resourceKey, type MockDb, type ResourceType } from './schema'
import { seed } from './seed'

export const DB_STORAGE_KEY = 'kurio:mock-db:v1'
/** Versão do formato gravado; subir quando o `MockDb` mudar de forma incompatível. */
export const DB_SCHEMA_VERSION = 1

export type MockStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Marca um recurso como tocado: `mutate` incrementa `versions['<type>:<id>']` uma vez por chamada. */
export type Touch = (type: ResourceType, id: Id) => void

export interface StoreOptions {
  storage: MockStorage
  /** Só `rules.emptyCatalog` influencia o seed. */
  scenario: Pick<Scenario, 'rules'>
  bus?: Bus
  /** Relógio do `occurredAt` dos eventos (injetável nos testes). */
  now?: () => Date
}

export interface Store {
  /** Estado confirmado. Somente leitura: alterar aqui não persiste nem versiona; use `mutate`. */
  getDb: () => MockDb
  /**
   * Roda `fn` sobre uma cópia; se não lançar, a cópia vira o estado, as versões dos recursos
   * declarados em `touch` sobem, grava no storage e publica no bus. Se lançar, nada muda.
   * Devolve o retorno de `fn`. Síncrono.
   */
  mutate: <T>(fn: (db: MockDb, touch: Touch) => T) => T
  /** Volta ao seed (versões incluídas), grava e publica `{ name: 'reset' }`. */
  reset: () => void
  bus: Bus
}

interface Persisted {
  schema: number
  catalog: 'full' | 'empty'
  db: MockDb
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function load(storage: MockStorage, catalog: Persisted['catalog']): MockDb | null {
  let raw: string | null
  try {
    raw = storage.getItem(DB_STORAGE_KEY)
  } catch {
    return null
  }
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.schema !== DB_SCHEMA_VERSION || parsed.catalog !== catalog) return null
    const db = parsed.db
    if (!isRecord(db) || !DB_COLLECTIONS.every((key) => isRecord(db[key]))) return null
    return db as unknown as MockDb
  } catch {
    return null
  }
}

export function createStore({ storage, scenario, bus = createBus(), now = () => new Date() }: StoreOptions): Store {
  const catalog: Persisted['catalog'] = scenario.rules?.emptyCatalog ? 'empty' : 'full'

  const persist = (db: MockDb) => {
    const payload: Persisted = { schema: DB_SCHEMA_VERSION, catalog, db }
    try {
      storage.setItem(DB_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // storage cheio ou bloqueado: o mock segue só em memória
    }
  }

  const loaded = load(storage, catalog)
  let current: MockDb = loaded ?? seed(scenario)
  if (loaded === null) {
    try {
      storage.removeItem(DB_STORAGE_KEY)
    } catch {
      // idem
    }
    persist(current)
  }

  const mutate: Store['mutate'] = (fn) => {
    const draft = structuredClone(current)
    const touched = new Map<string, [ResourceType, Id]>()
    const result = fn(draft, (type, id) => touched.set(resourceKey(type, id), [type, id]))

    for (const key of touched.keys()) draft.versions[key] = (draft.versions[key] ?? 0) + 1
    current = draft
    persist(draft)

    const occurredAt = now().toISOString()
    for (const [key, [type, id]] of touched) {
      const version = draft.versions[key] ?? 1
      if (type === 'nft') {
        const nft = draft.nfts[id]
        if (!nft) continue
        bus.publish({
          name: 'nft.updated',
          event: {
            eventId: crypto.randomUUID(),
            resource: { type: 'nft', id },
            version,
            occurredAt,
            payload: { id, price: nft.price, editions: nft.editions },
          },
        })
      } else if (type === 'order') {
        const order = draft.orders[id]
        if (!order) continue
        bus.publish({
          name: 'order.updated',
          event: {
            eventId: crypto.randomUUID(),
            resource: { type: 'order', id },
            version,
            occurredAt,
            payload: { id, status: order.status },
          },
        })
      }
    }
    return result
  }

  const reset = () => {
    current = seed(scenario)
    persist(current)
    bus.publish({ name: 'reset' })
  }

  return { getDb: () => current, mutate, reset, bus }
}
