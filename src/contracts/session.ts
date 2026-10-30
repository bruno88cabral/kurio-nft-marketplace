import type { Id } from './common'

// TODO M3: campos da sessão dependem do fluxo de login/cadastro
export interface Account {
  id: Id
  email: string
  name: string
}

export interface Session {
  account: Account
}
