import type { Id } from './common'
import type { NftEditionKind } from './nft'

export interface CartItem {
  nftId: Id
  edition: NftEditionKind
  quantity: number
}

export interface Cart {
  items: CartItem[]
}
