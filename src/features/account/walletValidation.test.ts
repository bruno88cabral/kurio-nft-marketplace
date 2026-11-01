import { describe, expect, it } from 'vitest'
import { ApiError } from '@/contracts'
import { NETWORKS } from '@/lib/wallets'
import { MAX_LABEL as MOCK_MAX_WALLET_LABEL } from '@/mocks/handlers/wallets'
import {
  FIELD_MESSAGES,
  GENERIC_FORM_ERROR,
  MAX_WALLET_LABEL,
  WALLET_ADDRESS_PATTERN,
  actionErrorMessage,
  isNetwork,
  toFormErrors,
  validateRenameWallet,
  validateWallet,
  validateWalletAddress,
} from './validation'

describe('validateWallet / validateRenameWallet', () => {
  const address = `0x${'aB12'.repeat(10)}`
  const valid = { address, network: 'polygon' as const, label: '' }

  it('mesmas regras do mock', () => {
    expect(MAX_WALLET_LABEL).toBe(MOCK_MAX_WALLET_LABEL)
    expect(WALLET_ADDRESS_PATTERN.source).toBe('^0x[0-9a-fA-F]{40}$')
    expect(NETWORKS).toEqual(['ethereum', 'polygon', 'arbitrum', 'optimism'])
  })

  it('0x + 40 hex (maiúsculas ou minúsculas), com trim', () => {
    expect(validateWalletAddress(address)).toBeUndefined()
    expect(validateWalletAddress(`  ${address.toLowerCase()} `)).toBeUndefined()
  })

  it('endereço vazio, curto, longo ou não hexadecimal', () => {
    expect(validateWalletAddress('  ')).toBe(FIELD_MESSAGES.walletAddressRequired)
    expect(validateWalletAddress('0x123')).toBe(FIELD_MESSAGES.walletAddressInvalid)
    expect(validateWalletAddress(`${address}0`)).toBe(FIELD_MESSAGES.walletAddressInvalid)
    expect(validateWalletAddress(`0x${'g'.repeat(40)}`)).toBe(FIELD_MESSAGES.walletAddressInvalid)
    expect(validateWalletAddress('ab'.repeat(21))).toBe(FIELD_MESSAGES.walletAddressInvalid)
  })

  it('rede precisa ser uma das 4', () => {
    expect(validateWallet({ ...valid, network: '' })).toEqual({ network: FIELD_MESSAGES.walletNetworkRequired })
    expect(isNetwork('solana')).toBe(false)
    for (const network of NETWORKS) expect(validateWallet({ ...valid, network })).toEqual({})
  })

  it('apelido opcional no cadastro, até 40', () => {
    expect(validateWallet(valid)).toEqual({})
    expect(validateWallet({ ...valid, label: 'a'.repeat(40) })).toEqual({})
    expect(validateWallet({ ...valid, label: 'a'.repeat(41) })).toEqual({ label: FIELD_MESSAGES.walletLabelTooLong })
  })

  it('apelido obrigatório ao renomear', () => {
    expect(validateRenameWallet({ label: '  ' })).toEqual({ label: FIELD_MESSAGES.walletLabelRequired })
    expect(validateRenameWallet({ label: 'a'.repeat(41) })).toEqual({ label: FIELD_MESSAGES.walletLabelTooLong })
    expect(validateRenameWallet({ label: 'Cofre' })).toEqual({})
  })

  it('tudo inválido de uma vez', () => {
    expect(validateWallet({ address: '0x123', network: '', label: 'a'.repeat(41) })).toEqual({
      address: FIELD_MESSAGES.walletAddressInvalid,
      network: FIELD_MESSAGES.walletNetworkRequired,
      label: FIELD_MESSAGES.walletLabelTooLong,
    })
  })
})

describe('toFormErrors com conflictField (Carteiras)', () => {
  const fields = ['address', 'network', 'label'] as const
  const conflict = new ApiError({ code: 'conflict', message: 'Esta carteira já está conectada.' }, 409)

  it('409 vai para o campo dado com a mensagem do servidor', () => {
    expect(toFormErrors(conflict, fields, { conflictField: 'address' })).toEqual({
      fieldErrors: { address: 'Esta carteira já está conectada.' },
    })
  })

  it('campo que não existe no formulário: erro do formulário', () => {
    expect(toFormErrors(conflict, fields, { conflictField: 'email' })).toEqual({
      formError: 'Esta carteira já está conectada.',
      fieldErrors: {},
    })
  })

  it('sem conflictField, o 409 não vira e-mail num formulário sem e-mail', () => {
    expect(toFormErrors(conflict, fields).formError).toBe(GENERIC_FORM_ERROR)
  })
})

describe('actionErrorMessage', () => {
  it('401 não gera mensagem (o ciclo de vida avisa)', () => {
    expect(actionErrorMessage(new ApiError({ code: 'unauthorized', message: 'x' }, 401))).toBeUndefined()
  })

  it('422 sem campo usa a mensagem do servidor; o resto, a genérica', () => {
    const error = new ApiError(
      { code: 'validation', message: 'Dados inválidos.', fieldErrors: { role: 'Defina outra carteira.' } },
      422,
    )
    expect(actionErrorMessage(error)).toBe('Dados inválidos.')
    expect(actionErrorMessage(new Error('boom'))).toBe(GENERIC_FORM_ERROR)
  })
})
