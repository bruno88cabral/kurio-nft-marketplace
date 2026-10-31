import type { Nft, NftEdition, NftEditionKind } from '@/contracts'
import { EDITION_ORDER, sortEditions } from '@/lib/editions'
import { clampInt } from '@/lib/quantity'

/**
 * Regras de edição e quantidade do Detalhe. Delegam aos helpers do kit (`@/lib/editions`,
 * `@/lib/quantity`) para a ordem e o clamp serem os mesmos do `EditionChips`/`QuantityStepper`.
 */

export function isEditionKind(value: unknown): value is NftEditionKind {
  return typeof value === 'string' && (EDITION_ORDER as readonly string[]).includes(value)
}

/** Primeira edição com unidade disponível, na ordem da UI (1/1, 1/10, 1/50, ABERTA). */
export function defaultEdition(nft: Pick<Nft, 'editions'>): NftEdition | undefined {
  return sortEditions(nft.editions).find((e) => e.available > 0)
}

export interface ResolvedEdition {
  /** Edição efetiva; `undefined` quando tudo está esgotado. */
  edition: NftEdition | undefined
  /** A edição pedida em `?edition=` não existe no NFT ou está esgotada (aviso "Edição indisponível"). */
  unavailable: boolean
}

/** Edição pedida na URL se existir e tiver unidade; senão o padrão, sinalizando o aviso. */
export function resolveEdition(nft: Pick<Nft, 'editions'>, requested: NftEditionKind | undefined): ResolvedEdition {
  const match = requested === undefined ? undefined : nft.editions.find((e) => e.kind === requested)
  if (match && match.available > 0) return { edition: match, unavailable: false }
  return { edition: defaultEdition(nft), unavailable: requested !== undefined }
}

/** Quantidade em `[1, available]` da edição; sem edição (esgotado), 1. */
export function clampEditionQuantity(edition: Pick<NftEdition, 'available'> | undefined, quantity: number): number {
  return clampInt(quantity, 1, edition?.available ?? 1)
}
