import { useState } from 'react'
import type { Nft, NftEdition, NftEditionKind } from '@/contracts'
import { isSoldOut } from '@/lib/editions'
import { clampEditionQuantity, resolveEdition } from './edition'

export interface PurchaseSelection {
  /** Edição efetiva; `undefined` quando tudo está esgotado. */
  edition: NftEdition | undefined
  /** A edição pedida em `?edition=` não existe ou está esgotada (aviso "Edição indisponível"). */
  unavailable: boolean
  /** Quantidade em `[1, available]` da edição efetiva. */
  quantity: number
  setQuantity: (quantity: number) => void
  soldOut: boolean
}

/**
 * Seleção de compra do Detalhe (edição da URL + quantidade). Mora na rota para o `PurchasePanel`
 * (desktop) e a `MobilePurchaseBar` mostrarem e adicionarem a mesma quantidade. A quantidade é estado
 * local: remonte o componente que chama o hook com `key={nft.id}` ao trocar de NFT.
 */
export function usePurchaseSelection(
  nft: Pick<Nft, 'editions'>,
  requestedEdition: NftEditionKind | undefined,
): PurchaseSelection {
  const { edition, unavailable } = resolveEdition(nft, requestedEdition)
  const [rawQuantity, setQuantity] = useState(1)
  // Clamp derivado (sem efeito): trocar para uma edição com menos unidades limita na hora
  const quantity = clampEditionQuantity(edition, rawQuantity)
  return { edition, unavailable, quantity, setQuantity, soldOut: isSoldOut(nft.editions) }
}
