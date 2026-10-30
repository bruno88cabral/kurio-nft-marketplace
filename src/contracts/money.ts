declare const ethBrand: unique symbol

/** Valor em ETH como string decimal (ex.: "0.125"). Nunca `number`. */
export type EthAmount = string & { readonly [ethBrand]: true }
