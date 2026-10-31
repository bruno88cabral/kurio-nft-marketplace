import { queryOptions } from '@tanstack/react-query'
import type { ChangePasswordRequest, Id, Profile, UpdateProfileRequest } from '@/contracts'
import { apiClient } from './client'

/** Isolada por conta (a raiz `profile` é privada: o ciclo de vida reseta no login e no logout). */
export const profileKeys = {
  all: ['profile'] as const,
  detail: (accountId: Id) => ['profile', accountId] as const,
}

/** `GET /profile` da conta logada. O `accountId` só entra na chave (a API usa o Bearer). */
export function profileQuery(accountId: Id) {
  return queryOptions({
    queryKey: profileKeys.detail(accountId),
    queryFn: async ({ signal }) => (await apiClient.get<Profile>('/profile', { signal })).data,
  })
}

/** `PATCH /profile`. `avatarUrl: ''` remove o avatar. 422 traz `fieldErrors` (`displayName`, `avatarUrl`). */
export const updateProfile = (body: UpdateProfileRequest) =>
  apiClient.patch<Profile>('/profile', body).then((r) => r.data)

/** `PUT /profile/password` (204). Senha atual errada: 422 em `currentPassword`. Não invalida sessões. */
export const changePassword = (body: ChangePasswordRequest) =>
  apiClient.put<void>('/profile/password', body).then(() => undefined)
