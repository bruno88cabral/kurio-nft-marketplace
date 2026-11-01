// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { readAsDataUrl } from './avatar'

describe('readAsDataUrl (FileReader do jsdom)', () => {
  it('lê o arquivo como data URL', async () => {
    const file = new File(['abc'], 'a.png', { type: 'image/png' })
    await expect(readAsDataUrl(file)).resolves.toBe('data:image/png;base64,YWJj')
  })
})
