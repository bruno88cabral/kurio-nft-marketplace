import {
  WALLET_ADDRESS_PATTERN,
  compact,
  validateDisplayName,
  validateEmail,
  type FieldErrors,
} from '@/features/account/validation'

// Formulário "Perfil do colecionador" do Pagamento (Figma `Desktop/Pagamento.png`, MYK-1114 D6). Validação só
// no cliente: nenhum destes campos vai no pedido (`{ quoteId, walletId }`), na chave nem no snapshot da tentativa.
// Rede, Endereço e Tipo de carteira não estão aqui: derivam da carteira cadastrada escolhida (D1 a D3).

export interface CollectorValues {
  /** Preenchido com `profile.displayName`; editar aqui não altera o Perfil. */
  displayName: string
  username: string
  profileName: string
  /** Preenchido com `account.email`; editar aqui não altera a conta. */
  email: string
  referralCode: string
  /** Sem o ".eth": o sufixo é um texto fixo ao lado do campo (o Figma o desenha como select). */
  ensName: string
  /** Opcional: `nome.eth` ou endereço `0x`. */
  altWallet: string
  /** Opcional. */
  note: string
}

export type CollectorField = keyof CollectorValues

/**
 * Ordem visual do Figma desktop (2 colunas, lida linha a linha), para o foco no primeiro inválido
 * (`firstInvalidField`). Os campos da carteira (Rede, Endereço, Tipo) ficam entre eles na tela, mas não são daqui.
 */
export const COLLECTOR_FIELDS: readonly CollectorField[] = [
  'displayName',
  'username',
  'profileName',
  'altWallet',
  'referralCode',
  'email',
  'ensName',
  'note',
]

export const MAX_PROFILE_NAME = 60
export const MAX_COLLECTOR_NOTE = 500
/** Nome de usuário: 3 a 20 minúsculas, números ou `_` (sem `@`). */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/
/**
 * Código de indicação, sem diferenciar maiúsculas. Testado sobre o valor digitado (só com trim), não sobre o
 * `toUpperCase()`: a conversão expande alguns caracteres Unicode ("ß" vira "SS") e faria passar o que não é ASCII.
 * Quem exibe normaliza com `toUpperCase()`.
 */
export const REFERRAL_CODE_PATTERN = /^[A-Z0-9-]{4,16}$/i
/**
 * Nome ENS sem o ".eth": 3 a 63 letras, números ou hífen, sem hífen nas pontas. Testado sobre o valor em
 * minúsculas (o ENS não diferencia maiúsculas).
 */
export const ENS_LABEL_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/
/**
 * ENS completo, aceito na carteira secundária: `nome.eth` ou com subdomínios (`nova.kurio.eth`, do Figma mobile).
 * O rótulo antes do `.eth` segue `ENS_LABEL_PATTERN`; os subdomínios têm de 1 a 63, também sem hífen nas pontas.
 * Testado sobre o valor em minúsculas.
 */
export const ENS_NAME_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\.eth$/

export const COLLECTOR_MESSAGES = {
  usernameRequired: 'Informe um nome de usuário.',
  usernameInvalid: 'Use de 3 a 20 letras minúsculas, números ou _.',
  profileNameRequired: 'Informe o nome do perfil.',
  profileNameTooLong: `Use até ${MAX_PROFILE_NAME} caracteres.`,
  referralCodeRequired: 'Informe o código de indicação.',
  referralCodeInvalid: 'Use de 4 a 16 letras, números ou hífen.',
  ensNameRequired: 'Informe o nome ENS.',
  ensNameInvalid: 'Use de 3 a 63 letras, números ou hífen, sem hífen no início ou no fim e sem o .eth.',
  altWalletInvalid: 'Use um nome .eth ou um endereço 0x com 40 hexadecimais.',
  noteTooLong: `Use até ${MAX_COLLECTOR_NOTE} caracteres.`,
} as const

function validateUsername(username: string): string | undefined {
  const value = username.trim()
  if (!value) return COLLECTOR_MESSAGES.usernameRequired
  if (!USERNAME_PATTERN.test(value)) return COLLECTOR_MESSAGES.usernameInvalid
  return undefined
}

function validateProfileName(profileName: string): string | undefined {
  const value = profileName.trim()
  if (!value) return COLLECTOR_MESSAGES.profileNameRequired
  if (value.length > MAX_PROFILE_NAME) return COLLECTOR_MESSAGES.profileNameTooLong
  return undefined
}

function validateReferralCode(referralCode: string): string | undefined {
  const value = referralCode.trim()
  if (!value) return COLLECTOR_MESSAGES.referralCodeRequired
  if (!REFERRAL_CODE_PATTERN.test(value)) return COLLECTOR_MESSAGES.referralCodeInvalid
  return undefined
}

function validateEnsName(ensName: string): string | undefined {
  const value = ensName.trim().toLowerCase()
  if (!value) return COLLECTOR_MESSAGES.ensNameRequired
  if (!ENS_LABEL_PATTERN.test(value)) return COLLECTOR_MESSAGES.ensNameInvalid
  return undefined
}

function validateAltWallet(altWallet: string): string | undefined {
  const value = altWallet.trim()
  if (!value) return undefined
  if (ENS_NAME_PATTERN.test(value.toLowerCase()) || WALLET_ADDRESS_PATTERN.test(value)) return undefined
  return COLLECTOR_MESSAGES.altWalletInvalid
}

function validateNote(note: string): string | undefined {
  return note.trim().length > MAX_COLLECTOR_NOTE ? COLLECTOR_MESSAGES.noteTooLong : undefined
}

/**
 * Erro por campo do "Perfil do colecionador" (todas as regras depois do trim); campo ausente = válido. O nome
 * de exibição e o e-mail usam as regras da conta (`validateDisplayName`, até `MAX_DISPLAY_NAME`; `validateEmail`).
 */
export function validateCollector(values: CollectorValues): FieldErrors<CollectorField> {
  return compact({
    displayName: validateDisplayName(values.displayName),
    username: validateUsername(values.username),
    profileName: validateProfileName(values.profileName),
    email: validateEmail(values.email),
    referralCode: validateReferralCode(values.referralCode),
    ensName: validateEnsName(values.ensName),
    altWallet: validateAltWallet(values.altWallet),
    note: validateNote(values.note),
  })
}

/** Formulário vazio, com Nome de exibição e E-mail preenchidos pela conta (D6). */
export function emptyCollector(prefill: { displayName?: string; email?: string }): CollectorValues {
  return {
    displayName: prefill.displayName ?? '',
    username: '',
    profileName: '',
    email: prefill.email ?? '',
    referralCode: '',
    ensName: '',
    altWallet: '',
    note: '',
  }
}
