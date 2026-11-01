import type { CartItem, Id, NftEditionKind } from '@/contracts'
import { browserStorage, type SessionStorageLike } from '@/auth/sessionStorage'
import { EDITION_ORDER } from '@/lib/editions'

/** Carrinho do visitante (`CartItem[]` em JSON). Sem cotação: o total só aparece depois do login. */
export const ANONYMOUS_CART_KEY = 'kurio:cart'

/** Linhas guardadas; passando disso a mais antiga sai (FIFO), para o storage não crescer sem limite. */
export const MAX_ANONYMOUS_LINES = 50

const EMPTY: readonly CartItem[] = Object.freeze([])

const sameLine = (item: CartItem, nftId: Id, edition: NftEditionKind) => item.nftId === nftId && item.edition === edition

const isPositiveInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== 'object' || value === null) return false
  const { nftId, edition, quantity } = value as Record<string, unknown>
  return (
    typeof nftId === 'string' &&
    nftId !== '' &&
    typeof edition === 'string' &&
    (EDITION_ORDER as readonly string[]).includes(edition) &&
    isPositiveInt(quantity)
  )
}

/** Linhas válidas do JSON guardado; ausente, ilegível ou malformado vira vazio, linha inválida é descartada. */
export function parseAnonymousCart(raw: string | null): CartItem[] {
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isCartItem).map(({ nftId, edition, quantity }) => ({ nftId, edition, quantity }))
  } catch {
    return []
  }
}

/**
 * Soma na linha `nftId:edition` (ou cria), limitando a quantidade da linha ao `available`. Sem estoque
 * (`available < 1`) ou quantidade inválida, devolve a mesma lista. Acima de `MAX_ANONYMOUS_LINES` linhas, a mais antiga sai.
 */
export function withItem(items: readonly CartItem[], item: CartItem, available: number): CartItem[] {
  if (!isPositiveInt(item.quantity) || !(available >= 1)) return [...items]
  const cap = Math.floor(available)
  const line = items.find((i) => sameLine(i, item.nftId, item.edition))
  if (line) {
    return items.map((i) => (i === line ? { ...i, quantity: Math.min(i.quantity + item.quantity, cap) } : i))
  }
  const next = [...items, { nftId: item.nftId, edition: item.edition, quantity: Math.min(item.quantity, cap) }]
  return next.length > MAX_ANONYMOUS_LINES ? next.slice(next.length - MAX_ANONYMOUS_LINES) : next
}

/** Define a quantidade da linha (não soma). Menor que 1 remove; `available` (se informado) limita; linha ausente: nada muda. */
export function withQuantity(
  items: readonly CartItem[],
  nftId: Id,
  edition: NftEditionKind,
  quantity: number,
  available?: number,
): CartItem[] {
  if (!Number.isFinite(quantity)) return [...items]
  const whole = Math.trunc(quantity)
  if (whole < 1) return withoutItem(items, nftId, edition)
  const next = available === undefined ? whole : Math.max(1, Math.min(whole, Math.floor(available)))
  return items.map((i) => (sameLine(i, nftId, edition) ? { ...i, quantity: next } : i))
}

export function withoutItem(items: readonly CartItem[], nftId: Id, edition: NftEditionKind): CartItem[] {
  return items.filter((i) => !sameLine(i, nftId, edition))
}

export interface AnonymousCartStore {
  /** Linhas atuais; nunca lança. */
  read: () => CartItem[]
  /** Para o `useSyncExternalStore`: a mesma referência enquanto o JSON guardado não muda. */
  getSnapshot: () => readonly CartItem[]
  /** Escritas locais e o evento `storage` de outra aba (o `storage` só dispara em OUTRA aba). */
  subscribe: (listener: () => void) => () => void
  add: (item: CartItem, available: number) => void
  setQuantity: (nftId: Id, edition: NftEditionKind, quantity: number, available?: number) => void
  remove: (nftId: Id, edition: NftEditionKind) => void
  clear: () => void
}

/** `getStorage` devolve `null` quando o storage não existe (node, bloqueado): o carrinho fica vazio e as escritas somem. */
export function createAnonymousCartStore(getStorage: () => SessionStorageLike | null): AnonymousCartStore {
  const listeners = new Set<() => void>()
  let cache: { raw: string | null; items: readonly CartItem[] } = { raw: null, items: EMPTY }

  function rawValue(): string | null {
    try {
      return getStorage()?.getItem(ANONYMOUS_CART_KEY) ?? null
    } catch {
      return null
    }
  }

  function getSnapshot(): readonly CartItem[] {
    const raw = rawValue()
    if (raw === cache.raw) return cache.items
    const items = parseAnonymousCart(raw)
    cache = { raw, items: items.length === 0 ? EMPTY : items }
    return cache.items
  }

  const notify = () => listeners.forEach((listener) => listener())

  function write(items: readonly CartItem[]): void {
    try {
      const storage = getStorage()
      if (storage) {
        if (items.length === 0) storage.removeItem(ANONYMOUS_CART_KEY)
        else storage.setItem(ANONYMOUS_CART_KEY, JSON.stringify(items))
      }
    } catch {
      // storage cheio ou bloqueado: o carrinho do visitante só não persiste
    }
    notify()
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    const onStorage = (event: StorageEvent) => {
      if (event.key === ANONYMOUS_CART_KEY || event.key === null) listener()
    }
    const target = typeof window === 'undefined' ? null : window
    target?.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      target?.removeEventListener('storage', onStorage)
    }
  }

  return {
    read: () => [...getSnapshot()],
    getSnapshot,
    subscribe,
    add: (item, available) => write(withItem(getSnapshot(), item, available)),
    setQuantity: (nftId, edition, quantity, available) => write(withQuantity(getSnapshot(), nftId, edition, quantity, available)),
    remove: (nftId, edition) => write(withoutItem(getSnapshot(), nftId, edition)),
    clear: () => write([]),
  }
}

/** Instância do app (`localStorage`). */
export const anonymousCart = createAnonymousCartStore(browserStorage)

export const readAnonymousCart = anonymousCart.read
export const addAnonymousItem = anonymousCart.add
export const setAnonymousQuantity = anonymousCart.setQuantity
export const removeAnonymousItem = anonymousCart.remove
export const clearAnonymousCart = anonymousCart.clear
