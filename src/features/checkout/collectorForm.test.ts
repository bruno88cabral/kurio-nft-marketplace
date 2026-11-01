import { describe, expect, it } from 'vitest'
import { FIELD_MESSAGES, MAX_DISPLAY_NAME, firstInvalidField } from '@/features/account/validation'
import {
  COLLECTOR_FIELDS,
  COLLECTOR_MESSAGES,
  MAX_COLLECTOR_NOTE,
  MAX_PROFILE_NAME,
  emptyCollector,
  validateCollector,
  type CollectorValues,
} from './collectorForm'

const valid: CollectorValues = {
  displayName: 'Ana Souza',
  username: 'ana_souza',
  profileName: 'Coleção da Ana',
  email: 'ana@kurio.test',
  referralCode: 'KURIO-2026',
  ensName: 'ana-souza',
  altWallet: '',
  note: '',
}

const errorOf = (patch: Partial<CollectorValues>) => validateCollector({ ...valid, ...patch })

describe('validateCollector', () => {
  it('formulário completo e opcionais vazios: sem erro', () => {
    expect(validateCollector(valid)).toEqual({})
    expect(errorOf({ altWallet: '   ', note: '  ' })).toEqual({})
  })

  it('formulário vazio: erro em todos os obrigatórios e nenhum nos opcionais', () => {
    expect(validateCollector(emptyCollector({}))).toEqual({
      displayName: FIELD_MESSAGES.displayNameRequired,
      username: COLLECTOR_MESSAGES.usernameRequired,
      profileName: COLLECTOR_MESSAGES.profileNameRequired,
      email: FIELD_MESSAGES.emailRequired,
      referralCode: COLLECTOR_MESSAGES.referralCodeRequired,
      ensName: COLLECTOR_MESSAGES.ensNameRequired,
    })
  })

  it('displayName: obrigatório depois do trim e até MAX_DISPLAY_NAME', () => {
    expect(errorOf({ displayName: '   ' }).displayName).toBe(FIELD_MESSAGES.displayNameRequired)
    expect(errorOf({ displayName: ` ${'a'.repeat(MAX_DISPLAY_NAME)} ` }).displayName).toBeUndefined()
    expect(errorOf({ displayName: 'a'.repeat(MAX_DISPLAY_NAME + 1) }).displayName).toBe(FIELD_MESSAGES.displayNameTooLong)
  })

  it('username: 3 a 20 minúsculas, números ou _, sem @', () => {
    expect(errorOf({ username: ' abc ' }).username).toBeUndefined()
    expect(errorOf({ username: 'a_1'.repeat(6) + 'ab' }).username).toBeUndefined()
    for (const bad of ['ab', 'a'.repeat(21), '@ana', 'Ana', 'ana souza', 'ana-souza']) {
      expect(errorOf({ username: bad }).username, bad).toBe(COLLECTOR_MESSAGES.usernameInvalid)
    }
    expect(COLLECTOR_MESSAGES.usernameInvalid).toBe('Use de 3 a 20 letras minúsculas, números ou _.')
  })

  it('profileName: obrigatório e até 60', () => {
    expect(MAX_PROFILE_NAME).toBe(60)
    expect(errorOf({ profileName: ' ' }).profileName).toBe(COLLECTOR_MESSAGES.profileNameRequired)
    expect(errorOf({ profileName: 'a'.repeat(MAX_PROFILE_NAME) }).profileName).toBeUndefined()
    expect(errorOf({ profileName: 'a'.repeat(MAX_PROFILE_NAME + 1) }).profileName).toBe(
      COLLECTOR_MESSAGES.profileNameTooLong,
    )
  })

  it('email: a regra da conta', () => {
    expect(errorOf({ email: 'ana@' }).email).toBe(FIELD_MESSAGES.emailInvalid)
    expect(errorOf({ email: ' ana@kurio.test ' }).email).toBeUndefined()
  })

  it('referralCode: 4 a 16 letras, números ou hífen, sem diferenciar maiúsculas', () => {
    expect(errorOf({ referralCode: 'kurio-2026' }).referralCode).toBeUndefined()
    expect(errorOf({ referralCode: ' AB12 ' }).referralCode).toBeUndefined()
    expect(errorOf({ referralCode: 'A'.repeat(16) }).referralCode).toBeUndefined()
    for (const bad of ['ab1', 'A'.repeat(17), 'KURIO_2026', 'KURIO 26']) {
      expect(errorOf({ referralCode: bad }).referralCode, bad).toBe(COLLECTOR_MESSAGES.referralCodeInvalid)
    }
  })

  it('ensName: 3 a 63 minúsculas, números ou hífen, sem o .eth', () => {
    expect(errorOf({ ensName: 'abc' }).ensName).toBeUndefined()
    expect(errorOf({ ensName: 'a'.repeat(63) }).ensName).toBeUndefined()
    for (const bad of ['ab', 'a'.repeat(64), 'ana.eth', 'Ana', 'ana_souza']) {
      expect(errorOf({ ensName: bad }).ensName, bad).toBe(COLLECTOR_MESSAGES.ensNameInvalid)
    }
  })

  it('altWallet: opcional; preenchido, nome.eth ou endereço 0x com 40 hexadecimais', () => {
    expect(errorOf({ altWallet: 'nova-kurio.eth' }).altWallet).toBeUndefined()
    expect(errorOf({ altWallet: ` 0x${'aF'.repeat(20)} ` }).altWallet).toBeUndefined()
    for (const bad of ['ana', 'ab.eth', `0x${'a'.repeat(39)}`, `0x${'g'.repeat(40)}`]) {
      expect(errorOf({ altWallet: bad }).altWallet, bad).toBe(COLLECTOR_MESSAGES.altWalletInvalid)
    }
    expect(COLLECTOR_MESSAGES.altWalletInvalid).toBe('Use um nome .eth ou um endereço 0x com 40 hexadecimais.')
  })

  it('note: opcional e até 500', () => {
    expect(errorOf({ note: 'a'.repeat(MAX_COLLECTOR_NOTE) }).note).toBeUndefined()
    expect(errorOf({ note: 'a'.repeat(MAX_COLLECTOR_NOTE + 1) }).note).toBe(COLLECTOR_MESSAGES.noteTooLong)
  })
})

describe('COLLECTOR_FIELDS', () => {
  it('segue a ordem visual do Figma desktop, linha a linha', () => {
    expect(COLLECTOR_FIELDS).toEqual([
      'displayName',
      'username',
      'profileName',
      'altWallet',
      'referralCode',
      'email',
      'ensName',
      'note',
    ])
  })

  it('cobre todos os campos de CollectorValues e leva o foco ao primeiro inválido', () => {
    expect([...COLLECTOR_FIELDS].sort()).toEqual(Object.keys(emptyCollector({})).sort())
    const errors = validateCollector({ ...valid, email: '', note: 'a'.repeat(501), username: '' })
    expect(firstInvalidField(COLLECTOR_FIELDS, errors)).toBe('username')
  })
})

describe('emptyCollector', () => {
  it('preenche nome de exibição e e-mail da conta; o resto vazio', () => {
    expect(emptyCollector({ displayName: 'Ana', email: 'ana@kurio.test' })).toEqual({
      displayName: 'Ana',
      username: '',
      profileName: '',
      email: 'ana@kurio.test',
      referralCode: '',
      ensName: '',
      altWallet: '',
      note: '',
    })
    expect(emptyCollector({}).displayName).toBe('')
  })
})
