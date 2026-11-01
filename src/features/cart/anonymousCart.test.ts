import { describe, expect, it, vi } from 'vitest'
import type { CartItem } from '@/contracts'
import type { SessionStorageLike } from '@/auth/sessionStorage'
import {
  ANONYMOUS_CART_KEY,
  createAnonymousCartStore,
  MAX_ANONYMOUS_LINES,
  parseAnonymousCart,
  withItem,
  withQuantity,
  withoutItem,
} from './anonymousCart'

function memory(initial?: string): SessionStorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set(ANONYMOUS_CART_KEY, initial)
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

const line = (nftId: string, edition: CartItem['edition'], quantity: number): CartItem => ({ nftId, edition, quantity })

describe('withItem', () => {
  it('soma na mesma linha nftId:edition', () => {
    const items = withItem([line('a', '1/10', 1)], line('a', '1/10', 2), 10)
    expect(items).toEqual([line('a', '1/10', 3)])
  })

  it('edição diferente do mesmo NFT é outra linha', () => {
    expect(withItem([line('a', '1/10', 1)], line('a', 'open', 1), 10)).toEqual([line('a', '1/10', 1), line('a', 'open', 1)])
  })

  it('limita a linha ao available informado', () => {
    expect(withItem([line('a', 'open', 4)], line('a', 'open', 5), 6)).toEqual([line('a', 'open', 6)])
    expect(withItem([], line('a', 'open', 9), 3)).toEqual([line('a', 'open', 3)])
  })

  it('sem estoque ou quantidade inválida não muda nada', () => {
    const items = [line('a', 'open', 1)]
    expect(withItem(items, line('b', 'open', 1), 0)).toEqual(items)
    expect(withItem(items, line('b', 'open', 0), 5)).toEqual(items)
    expect(withItem(items, line('b', 'open', 1.5), 5)).toEqual(items)
  })

  it('não muta a lista recebida', () => {
    const items = [line('a', 'open', 1)]
    withItem(items, line('a', 'open', 1), 5)
    expect(items).toEqual([line('a', 'open', 1)])
  })

  it('passando do limite a linha mais antiga sai (FIFO)', () => {
    let items: CartItem[] = []
    for (let i = 0; i < MAX_ANONYMOUS_LINES + 2; i++) items = withItem(items, line(`n${i}`, 'open', 1), 5)
    expect(items).toHaveLength(MAX_ANONYMOUS_LINES)
    expect(items[0]?.nftId).toBe('n2')
    expect(items.at(-1)?.nftId).toBe(`n${MAX_ANONYMOUS_LINES + 1}`)
  })
})

describe('withQuantity / withoutItem', () => {
  it('define (não soma), remove abaixo de 1 e respeita o available', () => {
    const items = [line('a', 'open', 2), line('b', 'open', 1)]
    expect(withQuantity(items, 'a', 'open', 5)).toEqual([line('a', 'open', 5), line('b', 'open', 1)])
    expect(withQuantity(items, 'a', 'open', 9, 4)).toEqual([line('a', 'open', 4), line('b', 'open', 1)])
    expect(withQuantity(items, 'a', 'open', 0)).toEqual([line('b', 'open', 1)])
    expect(withQuantity(items, 'z', 'open', 3)).toEqual(items)
    expect(withoutItem(items, 'b', 'open')).toEqual([line('a', 'open', 2)])
  })
})

describe('parseAnonymousCart', () => {
  it('JSON inválido, ausente ou que não é lista vira carrinho vazio', () => {
    expect(parseAnonymousCart(null)).toEqual([])
    expect(parseAnonymousCart('{nope')).toEqual([])
    expect(parseAnonymousCart('{"a":1}')).toEqual([])
  })

  it('descarta só as linhas malformadas', () => {
    const raw = JSON.stringify([line('a', 'open', 2), { nftId: 'b', edition: '9/9', quantity: 1 }, { nftId: 'c' }, null, line('d', '1/1', 0)])
    expect(parseAnonymousCart(raw)).toEqual([line('a', 'open', 2)])
  })
})

describe('createAnonymousCartStore', () => {
  it('persiste em kurio:cart e lê de volta', () => {
    const storage = memory()
    const store = createAnonymousCartStore(() => storage)
    store.add(line('a', '1/10', 1), 5)
    store.add(line('a', '1/10', 2), 5)
    expect(JSON.parse(storage.map.get('kurio:cart') ?? 'null')).toEqual([line('a', '1/10', 3)])
    expect(store.read()).toEqual([line('a', '1/10', 3)])
  })

  it('add diz se entrou inteiro, só em parte ou nada; unchanged com a linha já no available ou sem estoque, sem escrever nem notificar', () => {
    const storage = memory()
    const store = createAnonymousCartStore(() => storage)
    const listener = vi.fn()
    store.subscribe(listener)
    expect(store.add(line('a', '1/10', 2), 3)).toBe('added')
    expect(store.add(line('a', '1/10', 5), 3)).toBe('partial') // clamp parcial: 2 -> 3
    expect(store.add(line('a', '1/10', 1), 3)).toBe('unchanged') // já no limite
    expect(store.add(line('b', 'open', 1), 0)).toBe('unchanged') // sem estoque
    expect(store.read()).toEqual([line('a', '1/10', 3)])
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('add de linha nova acima do available e add com o estoque que caiu (a linha desce) são partial', () => {
    const storage = memory(JSON.stringify([line('a', '1/10', 5)]))
    const store = createAnonymousCartStore(() => storage)
    expect(store.add(line('b', 'open', 4), 2)).toBe('partial') // linha nova: 4 pedidas, 2 cabem
    expect(store.add(line('a', '1/10', 1), 3)).toBe('partial') // estoque caiu para 3: 5 -> 3
    expect(store.read()).toEqual([line('a', '1/10', 3), line('b', 'open', 2)])
  })

  it('clear remove a chave', () => {
    const storage = memory(JSON.stringify([line('a', 'open', 1)]))
    const store = createAnonymousCartStore(() => storage)
    store.clear()
    expect(storage.map.has('kurio:cart')).toBe(false)
    expect(store.read()).toEqual([])
  })

  it('storage que lança vira carrinho vazio e as escritas não lançam', () => {
    const boom = () => {
      throw new Error('bloqueado')
    }
    const store = createAnonymousCartStore(() => ({ getItem: boom, setItem: boom, removeItem: boom }))
    expect(store.read()).toEqual([])
    expect(() => store.add(line('a', 'open', 1), 5)).not.toThrow()
    expect(() => store.clear()).not.toThrow()
  })

  it('storage indisponível (null) também é vazio', () => {
    const store = createAnonymousCartStore(() => null)
    expect(store.read()).toEqual([])
    expect(() => store.remove('a', 'open')).not.toThrow()
  })

  it('JSON inválido no storage vira vazio e a próxima escrita recomeça limpa', () => {
    const storage = memory('{quebrado')
    const store = createAnonymousCartStore(() => storage)
    expect(store.read()).toEqual([])
    store.add(line('a', 'open', 1), 5)
    expect(store.read()).toEqual([line('a', 'open', 1)])
  })

  it('getSnapshot devolve a mesma referência enquanto o JSON não muda', () => {
    const storage = memory(JSON.stringify([line('a', 'open', 1)]))
    const store = createAnonymousCartStore(() => storage)
    const first = store.getSnapshot()
    expect(store.getSnapshot()).toBe(first)
    store.add(line('b', 'open', 1), 5)
    expect(store.getSnapshot()).not.toBe(first)
    storage.map.delete('kurio:cart')
    expect(store.getSnapshot()).toBe(store.getSnapshot())
    expect(store.getSnapshot()).toEqual([])
  })

  it('notifica quem assinou nas escritas locais, até cancelar a assinatura', () => {
    const store = createAnonymousCartStore(() => memory())
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.add(line('a', 'open', 1), 5)
    store.setQuantity('a', 'open', 3)
    store.remove('a', 'open')
    expect(listener).toHaveBeenCalledTimes(3)
    unsubscribe()
    store.clear()
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
