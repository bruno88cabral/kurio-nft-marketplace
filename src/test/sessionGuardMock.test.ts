import { describe, expect, it } from 'vitest'
import { bumpSession, guardChecks, sessionGuardMock } from './sessionGuardMock'

describe('sessionGuardMock', () => {
  const { captureSession, isSameSession } = sessionGuardMock()

  it('a captura feita antes do bump deixa de valer', () => {
    const check = captureSession()
    expect(check()).toBe(true)
    bumpSession()
    expect(check()).toBe(false)
    expect(isSameSession(check)).toBe(false)
  })

  it('a captura feita depois do bump vale (pega a captura tardia)', () => {
    bumpSession()
    const late = captureSession()
    expect(late()).toBe(true)
    expect(isSameSession(late)).toBe(true)
  })

  it('sem captura não é a mesma sessão', () => {
    expect(isSameSession(undefined)).toBe(false)
    expect(guardChecks()).toEqual([false])
  })
})
