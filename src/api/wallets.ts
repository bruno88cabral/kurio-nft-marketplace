import { queryOptions, type QueryClient } from '@tanstack/react-query'
import type { CreateWalletRequest, Id, UpdateWalletRequest, Wallet } from '@/contracts'
import { apiClient } from './client'
import { profileKeys } from './profile'

/**
 * Isolada por conta (a raiz `wallets` é privada: o ciclo de vida reseta no login e no logout).
 * O `Profile` embute as carteiras: toda mutation invalida também `['profile', accountId]`.
 */
export const walletKeys = {
  all: ['wallets'] as const,
  list: (accountId: Id) => ['wallets', accountId] as const,
}

/** `GET /wallets` da conta logada. O `accountId` só entra na chave (a API usa o Bearer). */
export function walletsQuery(accountId: Id) {
  return queryOptions({
    queryKey: walletKeys.list(accountId),
    queryFn: async ({ signal }) => (await apiClient.get<Wallet[]>('/wallets', { signal })).data,
  })
}

/**
 * Depois de qualquer mutation de carteira: a lista e o perfil (que embute as carteiras) da conta.
 * Devolve a promessa do refetch para a ação só terminar com a lista já atualizada.
 */
export function invalidateWallets(queryClient: QueryClient, accountId: Id) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: walletKeys.list(accountId) }),
    queryClient.invalidateQueries({ queryKey: profileKeys.detail(accountId) }),
  ])
}

/** `POST /wallets` (201). 422 traz `fieldErrors` (`address`, `network`, `label`); 409 = mesmo endereço e rede. */
export const createWallet = (body: CreateWalletRequest) =>
  apiClient.post<Wallet>('/wallets', body).then((r) => r.data)

/** `PATCH /wallets/:id`. `role: 'primary'` rebaixa a principal anterior; rebaixar a principal dá 422 em `role`. */
export const updateWallet = (walletId: Id, body: UpdateWalletRequest) =>
  apiClient.patch<Wallet>(`/wallets/${encodeURIComponent(walletId)}`, body).then((r) => r.data)

/** `DELETE /wallets/:id` (204). Se era a principal, a primeira restante assume. */
export const deleteWallet = (walletId: Id) =>
  apiClient.delete<void>(`/wallets/${encodeURIComponent(walletId)}`).then(() => undefined)
