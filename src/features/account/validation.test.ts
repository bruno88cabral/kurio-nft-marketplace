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
} from './validation'

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
