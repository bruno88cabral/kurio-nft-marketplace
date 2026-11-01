// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { announce, clearAnnouncement } from '@/lib/announcer'
import { LiveAnnouncer } from './LiveAnnouncer'

afterEach(() => {
  act(() => clearAnnouncement())
  cleanup()
})

describe('LiveAnnouncer', () => {
  it('é uma região aria-live só, com a última frase', () => {
    const { container } = render(<LiveAnnouncer />)
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(1)
    act(() => announce('Adicionado aos favoritos.'))
    act(() => announce('O preço de Emerald Ape #042 mudou.'))
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('O preço de Emerald Ape #042 mudou.')
  })

  it('a mesma frase duas vezes remonta o texto (é lida de novo)', () => {
    const { container } = render(<LiveAnnouncer />)
    act(() => announce('Removido dos favoritos.'))
    const first = container.querySelector('[aria-live] span')
    act(() => announce('Removido dos favoritos.'))
    const second = container.querySelector('[aria-live] span')
    expect(second?.textContent).toBe('Removido dos favoritos.')
    expect(second).not.toBe(first)
  })

  it('clearAnnouncement esvazia a região', () => {
    const { container } = render(<LiveAnnouncer />)
    act(() => announce('Adicionado aos favoritos.'))
    act(() => clearAnnouncement())
    expect(container.querySelector('[aria-live]')?.textContent).toBe('')
  })
})
