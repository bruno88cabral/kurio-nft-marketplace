import { describe, expect, it } from 'vitest'
import { FIXTURE_PASSWORD, USERS } from '../fixtures/users'
import { hashPassword } from './password'

describe('hashPassword', () => {
  it('o hash pré-calculado de cada fixture bate com a senha documentada', async () => {
    for (const user of USERS) {
      expect(await hashPassword(FIXTURE_PASSWORD, user.salt)).toBe(user.passwordHash)
    }
  })

  it('senha ou salt diferentes mudam o hash', async () => {
    const [ana] = USERS
    expect(await hashPassword('outra', ana.salt)).not.toBe(ana.passwordHash)
    expect(await hashPassword(FIXTURE_PASSWORD, 'outro-salt')).not.toBe(ana.passwordHash)
  })
})
