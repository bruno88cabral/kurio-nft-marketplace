// @vitest-environment jsdom
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { FormField } from './FormField'

describe('FormField', () => {
  it('liga rótulo, ajuda e controle; obrigatório marca aria-required e mostra o asterisco', () => {
    renderWithProviders(
      <FormField label="Nome" required description="Ajuda" className="x">
        {(control) => <input {...control} />}
      </FormField>,
    )
    const input = screen.getByLabelText(/^Nome/)
    expect(input.getAttribute('aria-required')).toBe('true')
    expect(input.getAttribute('aria-invalid')).toBeNull()
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('Ajuda').id)
    expect(screen.getByText('*')).toBeTruthy()
  })

  it('sem ajuda, erro nem obrigatório não há aria-describedby nem asterisco', () => {
    const { container } = renderWithProviders(
      <FormField label="Opcional">{(control) => <input {...control} />}</FormField>,
    )
    const input = screen.getByLabelText('Opcional')
    expect(input.getAttribute('aria-describedby')).toBeNull()
    expect(input.getAttribute('aria-required')).toBeNull()
    expect(screen.queryByText('*')).toBeNull()
    expect(container.querySelector('[data-invalid]')).toBeNull()
    expect(container.querySelector('[data-disabled]')).toBeNull()
  })

  it('o erro do cliente tem prioridade sobre o do servidor e entra no describedby', () => {
    renderWithProviders(
      <FormField label="Campo" description="Ajuda" error="Erro local" apiError="Erro remoto">
        {(control) => <input {...control} />}
      </FormField>,
    )
    const input = screen.getByLabelText('Campo')
    expect(screen.getByText('Erro local')).toBeTruthy()
    expect(screen.queryByText('Erro remoto')).toBeNull()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe(`${screen.getByText('Ajuda').id} ${screen.getByText('Erro local').id}`)
  })

  it('só o erro do servidor também é exibido', () => {
    renderWithProviders(
      <FormField label="Campo" apiError="Erro remoto">
        {(control) => <input {...control} />}
      </FormField>,
    )
    expect(screen.getByText('Erro remoto')).toBeTruthy()
  })

  it('hideLabel esconde o rótulo só visualmente; disabled chega ao controle', () => {
    const { container } = renderWithProviders(
      <FormField label="Oculto" hideLabel disabled>
        {(control) => <input {...control} />}
      </FormField>,
    )
    expect(screen.getByText('Oculto').className).toContain('sr-only')
    expect((screen.getByLabelText<HTMLInputElement>('Oculto')).disabled).toBe(true)
    expect(container.querySelector('[data-disabled="true"]')).toBeTruthy()
  })
})
