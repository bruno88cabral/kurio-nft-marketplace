import type { Id, IsoDateTime } from './common'

// TODO M3: campos da sessão dependem do fluxo de login/cadastro
export interface Account {
  id: Id
  email: string
  name: string
}

/** `GET /auth/session` (header `Authorization: Bearer <token>`). */
export interface Session {
  token: string
  expiresAt: IsoDateTime
  account: Account
}

/** `POST /auth/login`, resposta `AuthResponse`. */
export interface LoginRequest {
  email: string
  password: string
}

/** `POST /auth/signup`, resposta `AuthResponse`. */
export interface SignupRequest {
  name: string
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  expiresAt: IsoDateTime
  account: Account
}
