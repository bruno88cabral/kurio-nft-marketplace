import type { NftEdition, NftEditionKind } from '@/contracts'

/** Ordem canônica das edições na UI (a do Figma: 1/1, 1/10, 1/50, ABERTA). */
export const EDITION_ORDER: readonly NftEditionKind[] = ['1/1', '1/10', '1/50', 'open']

const EDITION_LABEL: Record<NftEditionKind, string> = {
  '1/1': '1/1',
  '1/10': '1/10',
  '1/50': '1/50',
  open: 'ABERTA',
}

/** Rótulo de UI da edição (`'open'` vira "ABERTA"). */
export function editionLabel(kind: NftEditionKind): string {
  return EDITION_LABEL[kind]
}

/** Edições na ordem canônica, independente da ordem que vier do contrato. */
export function sortEditions<T extends Pick<NftEdition, 'kind'>>(editions: readonly T[]): T[] {
  return [...editions].sort((a, b) => EDITION_ORDER.indexOf(a.kind) - EDITION_ORDER.indexOf(b.kind))
}

/** Esgotado = nenhuma edição com unidade disponível (lista vazia também conta). */
export function isSoldOut(editions: readonly Pick<NftEdition, 'available'>[]): boolean {
  return editions.every((e) => e.available <= 0)
}
