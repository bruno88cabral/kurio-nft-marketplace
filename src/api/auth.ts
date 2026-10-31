import type { AuthResponse, LoginRequest, SignupRequest } from '@/contracts'
import { apiClient } from './client'

// Sem efeito colateral aqui: quem grava a sessão, limpa o cache e reconecta o socket é o
// ciclo de vida (`src/auth/sessionLifecycle.ts`: `establishSession` / `endSession`).

/** `POST /auth/login`. Senha errada rejeita com `ApiError` `unauthorized` (401) e não mexe na sessão atual. */
export const login = (body: LoginRequest) =>
  apiClient.post<AuthResponse>('/auth/login', body).then((r) => r.data)

/** `POST /auth/signup`. E-mail já usado rejeita com `ApiError` `conflict` (409). */
export const signup = (body: SignupRequest) =>
  apiClient.post<AuthResponse>('/auth/signup', body).then((r) => r.data)

/** `POST /auth/logout`. Idempotente. */
export const logout = () => apiClient.post<void>('/auth/logout').then(() => undefined)
