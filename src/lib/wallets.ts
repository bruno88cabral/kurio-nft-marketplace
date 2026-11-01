import type { Network, Wallet, WalletRole } from '@/contracts'

/**
 * Provedores de carteira oferecidos na conexão (Carteiras e Pagamento). É um conceito só de UI:
 * o contrato `Wallet` guarda endereço, rede e papel, não o provedor.
 */
export type WalletProvider = 'metamask' | 'walletconnect' | 'coinbase'

/** Ordem do Figma mobile (`70398:245..247`). */
export const WALLET_PROVIDERS: readonly WalletProvider[] = ['walletconnect', 'metamask', 'coinbase']

const PROVIDER_LABEL: Record<WalletProvider, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

/** Redes do contrato `Network`, na ordem em que aparecem nos seletores. */
export const NETWORKS: readonly Network[] = ['ethereum', 'polygon', 'arbitrum', 'optimism']

const NETWORK_LABEL: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
}

const ROLE_LABEL: Record<WalletRole, string> = {
  primary: 'Principal',
  secondary: 'Reserva',
}

export function walletProviderLabel(provider: WalletProvider): string {
  return PROVIDER_LABEL[provider]
}

export function networkLabel(network: Network): string {
  return NETWORK_LABEL[network]
}

export function walletRoleLabel(role: WalletRole): string {
  return ROLE_LABEL[role]
}

/** Principal primeiro; o resto na ordem da API (ordem de cadastro). Não muta a entrada. */
export function sortWallets(wallets: readonly Wallet[]): Wallet[] {
  return [...wallets].sort((a, b) => Number(b.role === 'primary') - Number(a.role === 'primary'))
}

/** `0x1234567890…abcd` → `0x1234…abcd`. Endereço curto volta inalterado. */
export function shortAddress(address: string, chars = 4): string {
  const head = address.startsWith('0x') ? chars + 2 : chars
  if (address.length <= head + chars + 1) return address
  return `${address.slice(0, head)}…${address.slice(-chars)}`
}
