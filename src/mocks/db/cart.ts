import type {
  AddCartItemRequest,
  Cart,
  CartItem,
  Id,
  MergeCartRequest,
  NftEdition,
  NftEditionKind,
  UpdateCartItemRequest,
} from '@/contracts'
import { conflict, invalid, missing } from './domainError'
import type { MockDb } from './schema'
import type { Touch } from './store'

/** Cria o carrinho: só dentro de `mutate` (a leitura usa `getCart`). */
function cartOf(db: MockDb, accountId: Id): Cart {
  return (db.carts[accountId] ??= { items: [] })
}

function editionOf(db: MockDb, nftId: Id, kind: NftEditionKind): { name: string; edition: NftEdition } {
  const nft = db.nfts[nftId]
  if (!nft) throw missing('NFT não encontrado.')
  const edition = nft.editions.find((e) => e.kind === kind)
  if (!edition) throw missing(`O NFT ${nft.name} não tem a edição ${kind}.`)
  return { name: nft.name, edition }
}

function assertQuantity(quantity: unknown): asserts quantity is number {
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
    throw invalid('Quantidade inválida.', { quantity: 'Use um inteiro maior ou igual a 1.' })
  }
}

function assertStock(name: string, edition: NftEdition, wanted: number): void {
  if (wanted > edition.available) {
    throw conflict(`Só restam ${edition.available} unidade(s) de ${name} (${edition.kind}).`, {
      quantity: `Disponível: ${edition.available}.`,
    })
  }
}

const same = (item: CartItem, nftId: Id, edition: NftEditionKind) => item.nftId === nftId && item.edition === edition

export function getCart(db: MockDb, accountId: Id): Cart {
  return db.carts[accountId] ?? { items: [] }
}

/** Soma à linha existente; acima do estoque da edição vira 409 `conflict`. */
export function addItem(db: MockDb, touch: Touch, accountId: Id, req: AddCartItemRequest): Cart {
  assertQuantity(req.quantity)
  const { name, edition } = editionOf(db, req.nftId, req.edition)
  const cart = cartOf(db, accountId)
  const line = cart.items.find((i) => same(i, req.nftId, req.edition))
  assertStock(name, edition, (line?.quantity ?? 0) + req.quantity)
  if (line) line.quantity += req.quantity
  else cart.items.push({ nftId: req.nftId, edition: req.edition, quantity: req.quantity })
  touch('cart', accountId)
  return cart
}

/** Define a quantidade da linha (não soma). */
export function updateItem(
  db: MockDb,
  touch: Touch,
  accountId: Id,
  nftId: Id,
  edition: NftEditionKind,
  req: UpdateCartItemRequest,
): Cart {
  assertQuantity(req.quantity)
  const cart = cartOf(db, accountId)
  const line = cart.items.find((i) => same(i, nftId, edition))
  if (!line) throw missing('Item não está no carrinho.')
  const found = editionOf(db, nftId, edition)
  assertStock(found.name, found.edition, req.quantity)
  line.quantity = req.quantity
  touch('cart', accountId)
  return cart
}

/** Remover quem não está no carrinho é um no-op (idempotente). */
export function removeItem(db: MockDb, touch: Touch, accountId: Id, nftId: Id, edition: NftEditionKind): Cart {
  const cart = cartOf(db, accountId)
  const before = cart.items.length
  cart.items = cart.items.filter((i) => !same(i, nftId, edition))
  if (cart.items.length !== before) touch('cart', accountId)
  return cart
}

/**
 * Carrinho anônimo entra no da conta: soma por edição, limitada ao `available`.
 * Linhas de NFT/edição desconhecidos, esgotados ou com quantidade inválida são descartadas.
 */
export function mergeCart(db: MockDb, touch: Touch, accountId: Id, req: MergeCartRequest): Cart {
  const cart = cartOf(db, accountId)
  for (const incoming of req.items) {
    if (!Number.isInteger(incoming.quantity) || incoming.quantity < 1) continue
    const edition = db.nfts[incoming.nftId]?.editions.find((e) => e.kind === incoming.edition)
    if (!edition) continue
    const line = cart.items.find((i) => same(i, incoming.nftId, incoming.edition))
    const quantity = Math.min((line?.quantity ?? 0) + incoming.quantity, edition.available)
    if (quantity < 1) continue
    if (line) line.quantity = quantity
    else cart.items.push({ nftId: incoming.nftId, edition: incoming.edition, quantity })
  }
  touch('cart', accountId)
  return cart
}

/** Guarda o código normalizado; o status (`applied`/`invalid`/`expired`) só é decidido na cotação. */
export function applyCoupon(db: MockDb, touch: Touch, accountId: Id, code: string): Cart {
  const normalized = code.trim().toUpperCase()
  if (!normalized) throw invalid('Informe o cupom.', { code: 'Informe o código do cupom.' })
  const cart = cartOf(db, accountId)
  cart.couponCode = normalized
  touch('cart', accountId)
  return cart
}

export function removeCoupon(db: MockDb, touch: Touch, accountId: Id): Cart {
  const cart = cartOf(db, accountId)
  if (cart.couponCode !== undefined) {
    delete cart.couponCode
    touch('cart', accountId)
  }
  return cart
}
