import { describe, expect, it } from 'vitest'
import { ApiError } from '@/contracts'
import {
  EMAIL_PATTERN,
  FIELD_MESSAGES,
  GENERIC_FORM_ERROR,
  INVALID_CREDENTIALS_MESSAGE,
  MIN_PASSWORD_LENGTH,
  SIGNUP_CONFLICT_MESSAGE,
  firstInvalidField,
  hasErrors,
  toFormErrors,
  validateEmail,
  validateLogin,
  validateNewPassword,
  validateSignup,
  MAX_DISPLAY_NAME,
  validateDisplayName,
  validatePassword,
  validateProfile,
} from './validation'
import { MAX_DISPLAY_NAME as MOCK_MAX_DISPLAY_NAME } from '@/mocks/handlers/profile'

const validSignup = { name: 'Carla', email: 'carla@kurio.test', password: 'Kurio#2026', confirmPassword: 'Kurio#2026' }

describe('constantes compartilhadas com o mock', () => {
  it('mínimo de 8 e a mesma regex de e-mail', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8)
    expect(EMAIL_PATTERN.source).toBe('^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$')
  })
})

describe('validateEmail', () => {
  it('aceita e-mail válido, com espaços nas pontas', () => {
    expect(validateEmail('ana@kurio.test')).toBeUndefined()
    expect(validateEmail('  ana@kurio.test ')).toBeUndefined()
  })

  it('vazio ou só espaços é obrigatório', () => {
    expect(validateEmail('')).toBe(FIELD_MESSAGES.emailRequired)
    expect(validateEmail('   ')).toBe(FIELD_MESSAGES.emailRequired)
  })

  it.each(['ana', 'ana@kurio', 'ana@@kurio.test', 'a na@kurio.test', '@kurio.test'])('rejeita %s', (email) => {
    expect(validateEmail(email)).toBe(FIELD_MESSAGES.emailInvalid)
  })
})

describe('validateNewPassword', () => {
  it('obrigatória e com o mínimo', () => {
    expect(validateNewPassword('')).toBe(FIELD_MESSAGES.passwordRequired)
    expect(validateNewPassword('1234567')).toBe(FIELD_MESSAGES.passwordTooShort)
    expect(validateNewPassword('12345678')).toBeUndefined()
  })
})

describe('validateLogin', () => {
  it('válido não tem erros', () => {
    expect(validateLogin({ email: 'ana@kurio.test', password: 'x' })).toEqual({})
  })

  it('campos vazios', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: FIELD_MESSAGES.emailRequired,
      password: FIELD_MESSAGES.passwordRequired,
    })
  })

  it('e-mail inválido', () => {
    expect(validateLogin({ email: 'ana', password: 'Kurio#2026' })).toEqual({ email: FIELD_MESSAGES.emailInvalid })
  })

  it('não exige o mínimo da senha (quem decide é o servidor)', () => {
    expect(validateLogin({ email: 'ana@kurio.test', password: '123' })).toEqual({})
  })
})

describe('validateSignup', () => {
  it('válido não tem erros', () => {
    expect(validateSignup(validSignup)).toEqual({})
  })

  it('tudo vazio: um erro por campo', () => {
    expect(validateSignup({ name: '', email: '', password: '', confirmPassword: '' })).toEqual({
      name: FIELD_MESSAGES.nameRequired,
      email: FIELD_MESSAGES.emailRequired,
      password: FIELD_MESSAGES.passwordRequired,
      confirmPassword: FIELD_MESSAGES.confirmRequired,
    })
  })

  it('nome só com espaços', () => {
    expect(validateSignup({ ...validSignup, name: '   ' })).toEqual({ name: FIELD_MESSAGES.nameRequired })
  })

  it('senha curta', () => {
    expect(validateSignup({ ...validSignup, password: 'abc', confirmPassword: 'abc' })).toEqual({
      password: FIELD_MESSAGES.passwordTooShort,
    })
  })

  it('confirmação diferente', () => {
    expect(validateSignup({ ...validSignup, confirmPassword: 'Kurio#2027' })).toEqual({
      confirmPassword: FIELD_MESSAGES.confirmMismatch,
    })
  })
})

describe('hasErrors / firstInvalidField', () => {
  it('segue a ordem do formulário', () => {
    const errors = { password: 'x', email: 'y' }
    expect(hasErrors(errors)).toBe(true)
    expect(hasErrors({})).toBe(false)
    expect(firstInvalidField(['email', 'password'], errors)).toBe('email')
    expect(firstInvalidField(['email', 'password'], {})).toBeUndefined()
  })
})

describe('toFormErrors', () => {
  const login = ['email', 'password'] as const
  const signup = ['name', 'email', 'password', 'confirmPassword'] as const

  it('401 vira erro do formulário com a mensagem fixa', () => {
    const error = new ApiError({ code: 'unauthorized', message: 'qualquer' }, 401)
    expect(toFormErrors(error, login)).toEqual({ formError: INVALID_CREDENTIALS_MESSAGE, fieldErrors: {} })
  })

  it('422 leva os fieldErrors conhecidos aos campos', () => {
    const error = new ApiError(
      { code: 'validation', message: 'Dados inválidos.', fieldErrors: { email: 'E-mail ruim.', extra: 'x' } },
      422,
    )
    expect(toFormErrors(error, login)).toEqual({ fieldErrors: { email: 'E-mail ruim.' } })
  })

  it('422 sem campo conhecido vira erro do formulário', () => {
    const error = new ApiError({ code: 'validation', message: 'Corpo inválido.' }, 422)
    expect(toFormErrors(error, login)).toEqual({ formError: 'Corpo inválido.', fieldErrors: {} })
  })

  it('409 vai para o e-mail no cadastro', () => {
    const error = new ApiError({ code: 'conflict', message: 'qualquer' }, 409)
    expect(toFormErrors(error, signup)).toEqual({ fieldErrors: { email: SIGNUP_CONFLICT_MESSAGE } })
  })

  it('transient, erro desconhecido ou não-ApiError: mensagem genérica', () => {
    expect(toFormErrors(new ApiError({ code: 'transient', message: 'x' }, 503), login)).toEqual({
      formError: GENERIC_FORM_ERROR,
      fieldErrors: {},
    })
    expect(toFormErrors(new Error('boom'), login).formError).toBe(GENERIC_FORM_ERROR)
  })
})

describe('toFormErrors nas telas logadas', () => {
  it('401 usa a mensagem dada (sessão expirada), não a de credenciais', () => {
    const error = new ApiError({ code: 'unauthorized', message: 'qualquer' }, 401)
    expect(toFormErrors(error, ['displayName'], { unauthorizedMessage: 'Sessão expirou.' })).toEqual({
      formError: 'Sessão expirou.',
      fieldErrors: {},
    })
  })

  it('422 da senha atual vai para o campo', () => {
    const error = new ApiError(
      { code: 'validation', message: 'Dados inválidos.', fieldErrors: { currentPassword: 'Senha atual incorreta.' } },
      422,
    )
    expect(toFormErrors(error, ['currentPassword', 'newPassword', 'confirmPassword'] as const)).toEqual({
      fieldErrors: { currentPassword: 'Senha atual incorreta.' },
    })
  })
})

describe('validateDisplayName / validateProfile', () => {
  it('mesmo máximo do mock', () => {
    expect(MAX_DISPLAY_NAME).toBe(MOCK_MAX_DISPLAY_NAME)
  })

  it('aceita até 60 depois do trim', () => {
    expect(validateDisplayName('Ana')).toBeUndefined()
    expect(validateDisplayName('a'.repeat(60))).toBeUndefined()
    expect(validateDisplayName(`  ${'a'.repeat(60)}  `)).toBeUndefined()
  })

  it('vazio ou só espaços é obrigatório', () => {
    expect(validateDisplayName('')).toBe(FIELD_MESSAGES.displayNameRequired)
    expect(validateDisplayName('   ')).toBe(FIELD_MESSAGES.displayNameRequired)
  })

  it('61 caracteres é longo demais', () => {
    expect(validateDisplayName('a'.repeat(61))).toBe(FIELD_MESSAGES.displayNameTooLong)
    expect(validateProfile({ displayName: 'a'.repeat(61) })).toEqual({ displayName: FIELD_MESSAGES.displayNameTooLong })
  })

  it('válido não tem erros', () => {
    expect(validateProfile({ displayName: 'Ana' })).toEqual({})
  })
})

describe('validatePassword', () => {
  const valid = { currentPassword: 'Kurio#2026', newPassword: 'Nova#2026x', confirmPassword: 'Nova#2026x' }

  it('válido não tem erros', () => {
    expect(validatePassword(valid)).toEqual({})
  })

  it('tudo vazio: um erro por campo', () => {
    expect(validatePassword({ currentPassword: '', newPassword: '', confirmPassword: '' })).toEqual({
      currentPassword: FIELD_MESSAGES.currentPasswordRequired,
      newPassword: FIELD_MESSAGES.passwordRequired,
      confirmPassword: FIELD_MESSAGES.confirmRequired,
    })
  })

  it('nova com menos de 8', () => {
    expect(validatePassword({ ...valid, newPassword: '1234567', confirmPassword: '1234567' })).toEqual({
      newPassword: FIELD_MESSAGES.passwordTooShort,
    })
  })

  it('nova igual à atual', () => {
    expect(validatePassword({ ...valid, newPassword: 'Kurio#2026', confirmPassword: 'Kurio#2026' })).toEqual({
      newPassword: FIELD_MESSAGES.newPasswordSameAsCurrent,
    })
  })

  it('confirmação diferente', () => {
    expect(validatePassword({ ...valid, confirmPassword: 'outra-senha' })).toEqual({
      confirmPassword: FIELD_MESSAGES.confirmMismatch,
    })
  })
})
