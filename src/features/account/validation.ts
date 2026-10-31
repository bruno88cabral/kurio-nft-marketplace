import { ApiError, isUnauthorized, type Network } from '@/contracts'
import { NETWORKS } from '@/lib/wallets'

// Validadores puros dos formulários da conta (MYK-1083). Mesmas regras do mock
// (`src/mocks/handlers/auth.ts`): o cliente avisa antes, o servidor continua sendo a fonte da verdade.

/** Erro por campo; campo ausente = válido. */
export type FieldErrors<K extends string> = Partial<Record<K, string>>

/** Mesma regra do mock para e-mail. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Mesmo mínimo do mock para senha. */
export const MIN_PASSWORD_LENGTH = 8
/** Mesmo máximo do mock para o nome de exibição (contado depois do trim). */
export const MAX_DISPLAY_NAME = 60
/** Mesma regra do mock para o endereço da carteira (`src/mocks/handlers/wallets.ts`). */
export const WALLET_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/
/** Mesmo máximo do mock para o apelido da carteira (contado depois do trim). */
export const MAX_WALLET_LABEL = 40

export const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha inválidos.'
export const SIGNUP_CONFLICT_MESSAGE = 'Já existe uma conta com este e-mail.'
export const DEMO_PASSWORD_NOTICE = 'Ambiente de demonstração: não use uma senha real.'
export const GENERIC_FORM_ERROR = 'Não foi possível concluir agora. Tente novamente.'

export const FIELD_MESSAGES = {
  nameRequired: 'Informe seu nome.',
  emailRequired: 'Informe seu e-mail.',
  emailInvalid: 'Informe um e-mail válido.',
  passwordRequired: 'Informe sua senha.',
  passwordTooShort: `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  confirmRequired: 'Confirme sua senha.',
  confirmMismatch: 'As senhas não conferem.',
  displayNameRequired: 'Informe um nome de exibição.',
  displayNameTooLong: `Use até ${MAX_DISPLAY_NAME} caracteres.`,
  currentPasswordRequired: 'Informe a senha atual.',
  newPasswordSameAsCurrent: 'A nova senha deve ser diferente da atual.',
  walletAddressRequired: 'Informe o endereço da carteira.',
  walletAddressInvalid: 'Endereço inválido. Use 0x seguido de 40 hexadecimais.',
  walletNetworkRequired: 'Selecione a rede.',
  walletLabelRequired: 'Informe um apelido.',
  walletLabelTooLong: `Use até ${MAX_WALLET_LABEL} caracteres.`,
} as const

export const PROFILE_UPDATED_MESSAGE = 'Perfil atualizado.'
export const PASSWORD_CHANGED_MESSAGE = 'Senha alterada.'
export const WALLET_MESSAGES = {
  added: 'Carteira adicionada.',
  promoted: 'Carteira definida como principal.',
  renamed: 'Carteira renomeada.',
  removed: 'Carteira removida.',
} as const

export interface LoginValues {
  email: string
  password: string
}

export interface SignupValues {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export function validateEmail(email: string): string | undefined {
  const value = email.trim()
  if (!value) return FIELD_MESSAGES.emailRequired
  if (!EMAIL_PATTERN.test(value)) return FIELD_MESSAGES.emailInvalid
  return undefined
}

/** Senha nova (cadastro, troca de senha): obrigatória e com o mínimo do mock. */
export function validateNewPassword(password: string): string | undefined {
  if (!password) return FIELD_MESSAGES.passwordRequired
  if (password.length < MIN_PASSWORD_LENGTH) return FIELD_MESSAGES.passwordTooShort
  return undefined
}

function compact<K extends string>(errors: Record<K, string | undefined>): FieldErrors<K> {
  const out: FieldErrors<K> = {}
  for (const key of Object.keys(errors) as K[]) {
    if (errors[key] !== undefined) out[key] = errors[key]
  }
  return out
}

export function validateLogin({ email, password }: LoginValues): FieldErrors<keyof LoginValues> {
  return compact({
    email: validateEmail(email),
    // No login não se exige o mínimo: conta antiga pode ter senha menor, quem decide é o servidor
    password: password ? undefined : FIELD_MESSAGES.passwordRequired,
  })
}

export function validateSignup({
  name,
  email,
  password,
  confirmPassword,
}: SignupValues): FieldErrors<keyof SignupValues> {
  return compact({
    name: name.trim() ? undefined : FIELD_MESSAGES.nameRequired,
    email: validateEmail(email),
    password: validateNewPassword(password),
    confirmPassword: !confirmPassword
      ? FIELD_MESSAGES.confirmRequired
      : confirmPassword !== password
        ? FIELD_MESSAGES.confirmMismatch
        : undefined,
  })
}

export interface ProfileValues {
  displayName: string
}

export interface PasswordValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

/** Nome de exibição: obrigatório e até 60 caracteres, depois do trim (como o mock). */
export function validateDisplayName(displayName: string): string | undefined {
  const value = displayName.trim()
  if (!value) return FIELD_MESSAGES.displayNameRequired
  if (value.length > MAX_DISPLAY_NAME) return FIELD_MESSAGES.displayNameTooLong
  return undefined
}

export function validateProfile({ displayName }: ProfileValues): FieldErrors<keyof ProfileValues> {
  return compact({ displayName: validateDisplayName(displayName) })
}

/**
 * Troca de senha: atual obrigatória; nova com o mínimo e diferente da atual (como o mock);
 * confirmação igual à nova (só no cliente: o contrato não tem o campo).
 */
export function validatePassword({
  currentPassword,
  newPassword,
  confirmPassword,
}: PasswordValues): FieldErrors<keyof PasswordValues> {
  return compact({
    currentPassword: currentPassword ? undefined : FIELD_MESSAGES.currentPasswordRequired,
    newPassword:
      validateNewPassword(newPassword) ??
      (currentPassword && newPassword === currentPassword ? FIELD_MESSAGES.newPasswordSameAsCurrent : undefined),
    confirmPassword: !confirmPassword
      ? FIELD_MESSAGES.confirmRequired
      : confirmPassword !== newPassword
        ? FIELD_MESSAGES.confirmMismatch
        : undefined,
  })
}

export interface WalletValues {
  address: string
  /** `''` enquanto nenhuma rede foi escolhida. */
  network: Network | ''
  /** Opcional no cadastro: vazio não é enviado (o mock dá o apelido "Carteira N"). */
  label: string
}

export interface WalletLabelValues {
  label: string
}

export function isNetwork(value: string): value is Network {
  return (NETWORKS as readonly string[]).includes(value)
}

/** Endereço: obrigatório, `0x` + 40 hexadecimais depois do trim (como o mock). */
export function validateWalletAddress(address: string): string | undefined {
  const value = address.trim()
  if (!value) return FIELD_MESSAGES.walletAddressRequired
  if (!WALLET_ADDRESS_PATTERN.test(value)) return FIELD_MESSAGES.walletAddressInvalid
  return undefined
}

/** Apelido: até 40 depois do trim; `required` no renomear (o mock recusa apelido vazio quando enviado). */
export function validateWalletLabel(label: string, { required = false } = {}): string | undefined {
  const value = label.trim()
  if (!value) return required ? FIELD_MESSAGES.walletLabelRequired : undefined
  if (value.length > MAX_WALLET_LABEL) return FIELD_MESSAGES.walletLabelTooLong
  return undefined
}

export function validateWallet({ address, network, label }: WalletValues): FieldErrors<keyof WalletValues> {
  return compact({
    address: validateWalletAddress(address),
    network: isNetwork(network) ? undefined : FIELD_MESSAGES.walletNetworkRequired,
    label: validateWalletLabel(label),
  })
}

export function validateRenameWallet({ label }: WalletLabelValues): FieldErrors<keyof WalletLabelValues> {
  return compact({ label: validateWalletLabel(label, { required: true }) })
}

/**
 * Mensagem de uma ação sem formulário (promover, remover carteira) para o toast. `undefined` no 401:
 * o ciclo de vida já avisa "Sua sessão expirou." e leva ao login.
 */
export function actionErrorMessage(error: unknown): string | undefined {
  if (isUnauthorized(error)) return undefined
  return toFormErrors(error, []).formError
}

export function hasErrors(errors: FieldErrors<string>): boolean {
  return Object.values(errors).some((message) => message !== undefined)
}

/** Primeiro campo com erro, na ordem visual do formulário (para mover o foco). */
export function firstInvalidField<K extends string>(order: readonly K[], errors: FieldErrors<K>): K | undefined {
  return order.find((key) => errors[key] !== undefined)
}

export interface FormErrorState<K extends string> {
  /** Erro do formulário inteiro (bloco `role="alert"`). */
  formError?: string
  /** Erros do servidor por campo (vão no `apiError` do `FormField`). */
  fieldErrors: FieldErrors<K>
}

export interface ToFormErrorsOptions {
  /**
   * Mensagem do 401. Padrão: "E-mail ou senha inválidos." (login). Nas telas logadas o 401 é sessão
   * expirada: o ciclo de vida já avisa e leva ao login, então passe `SESSION_EXPIRED_MESSAGE`.
   */
  unauthorizedMessage?: string
  /**
   * Campo que recebe o 409 com a mensagem do servidor (Carteiras: `address`, "Esta carteira já está
   * conectada."). Sem ele vale a regra do cadastro: o 409 vai para `email` com "Já existe uma conta…".
   */
  conflictField?: string
}

/**
 * Traduz a falha do envio em erro de formulário ou de campo:
 * - `validation` (422): `fieldErrors` dos campos conhecidos; sem nenhum conhecido, vira erro do formulário;
 * - `unauthorized` (401): `unauthorizedMessage` no formulário ("E-mail ou senha inválidos." no login;
 *   nas telas logadas, a mensagem de sessão expirada);
 * - `conflict` (409): com `conflictField`, a mensagem do servidor nesse campo (ou no formulário, se o
 *   campo não estiver em `fields`); sem ele, a regra do cadastro (erro no campo e-mail);
 * - o resto (`transient`, rede, inesperado): mensagem genérica para tentar de novo.
 */
export function toFormErrors<K extends string>(
  error: unknown,
  fields: readonly K[],
  { unauthorizedMessage = INVALID_CREDENTIALS_MESSAGE, conflictField }: ToFormErrorsOptions = {},
): FormErrorState<K> {
  if (error instanceof ApiError && error.code === 'conflict' && conflictField !== undefined) {
    return (fields as readonly string[]).includes(conflictField)
      ? { fieldErrors: { [conflictField]: error.message } as FieldErrors<K> }
      : { formError: error.message, fieldErrors: {} }
  }
  if (error instanceof ApiError) {
    if (error.code === 'validation') {
      const fieldErrors: FieldErrors<K> = {}
      for (const key of fields) {
        const message = error.fieldErrors?.[key]
        if (message) fieldErrors[key] = message
      }
      return hasErrors(fieldErrors) ? { fieldErrors } : { formError: error.message, fieldErrors }
    }
    if (error.code === 'unauthorized') return { formError: unauthorizedMessage, fieldErrors: {} }
    if (error.code === 'conflict' && (fields as readonly string[]).includes('email')) {
      return { fieldErrors: { email: SIGNUP_CONFLICT_MESSAGE } as FieldErrors<K> }
    }
  }
  return { formError: GENERIC_FORM_ERROR, fieldErrors: {} }
}
