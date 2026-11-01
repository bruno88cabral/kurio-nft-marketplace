import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_AVATAR_LENGTH } from '@/mocks/handlers/profile'
import { AVATAR_ACCEPT, AVATAR_MESSAGES, MAX_AVATAR_BYTES, checkAvatarFile, initials, readAsDataUrl } from './avatar'

describe('checkAvatarFile', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])('aceita %s pequeno', (type) => {
    expect(checkAvatarFile({ type, size: 10_000 })).toBeUndefined()
  })

  it.each(['image/svg+xml', 'image/bmp', 'application/pdf', ''])('recusa o tipo %j', (type) => {
    expect(checkAvatarFile({ type, size: 1_000 })).toBe(AVATAR_MESSAGES.invalidType)
  })

  it('aceita exatamente 140 KB e recusa 1 byte a mais', () => {
    expect(checkAvatarFile({ type: 'image/png', size: MAX_AVATAR_BYTES })).toBeUndefined()
    expect(checkAvatarFile({ type: 'image/png', size: MAX_AVATAR_BYTES + 1 })).toBe(AVATAR_MESSAGES.tooLarge)
  })

  it('recusa 1 MB', () => {
    expect(checkAvatarFile({ type: 'image/jpeg', size: 1024 * 1024 })).toBe(AVATAR_MESSAGES.tooLarge)
  })

  it('o maior arquivo aceito cabe no limite do mock em base64 (com o prefixo mais longo)', () => {
    const base64Length = Math.ceil(MAX_AVATAR_BYTES / 3) * 4
    expect('data:image/jpeg;base64,'.length + base64Length).toBeLessThanOrEqual(MAX_AVATAR_LENGTH)
  })

  it('o accept do input lista os mesmos tipos', () => {
    expect(AVATAR_ACCEPT).toBe('image/png,image/jpeg,image/webp,image/gif')
  })
})

describe('initials', () => {
  it('duas primeiras palavras', () => {
    expect(initials('Ana Souza Lima')).toBe('AS')
    expect(initials('bruno')).toBe('B')
    expect(initials('  élis   regina ')).toBe('ÉR')
  })

  it('vazio dá string vazia', () => {
    expect(initials('   ')).toBe('')
  })
})

describe('readAsDataUrl (FileReader simulado)', () => {
  class FakeReader {
    result: unknown = null
    error: Error | null = null
    onload?: () => void
    onerror?: () => void
    static behave: (reader: FakeReader) => void = () => {}
    readAsDataURL() {
      FakeReader.behave(this)
    }
  }
  const install = (behave: (reader: FakeReader) => void) => {
    FakeReader.behave = behave
    vi.stubGlobal('FileReader', FakeReader)
  }
  afterEach(() => vi.unstubAllGlobals())

  it('resolve com o resultado em texto', async () => {
    install((r) => {
      r.result = 'data:image/png;base64,AAAA'
      r.onload?.()
    })
    await expect(readAsDataUrl(new Blob(['x']))).resolves.toBe('data:image/png;base64,AAAA')
  })

  it('resultado que não é texto rejeita com a mensagem de leitura', async () => {
    install((r) => {
      r.result = new ArrayBuffer(1)
      r.onload?.()
    })
    await expect(readAsDataUrl(new Blob(['x']))).rejects.toThrow(AVATAR_MESSAGES.readFailed)
  })

  it('erro do leitor rejeita com o erro dele', async () => {
    const failure = new Error('boom')
    install((r) => {
      r.error = failure
      r.onerror?.()
    })
    await expect(readAsDataUrl(new Blob(['x']))).rejects.toBe(failure)
  })

  it('erro sem detalhe rejeita com a mensagem de leitura', async () => {
    install((r) => r.onerror?.())
    await expect(readAsDataUrl(new Blob(['x']))).rejects.toThrow(AVATAR_MESSAGES.readFailed)
  })
})
