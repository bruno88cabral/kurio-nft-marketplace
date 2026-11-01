// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/contracts'
import { renderWithProviders } from '@/test/render'
import { useAccountForm, type UseAccountFormOptions } from './useAccountForm'

const { session } = vi.hoisted(() => ({ session: { same: true } }))

vi.mock('@/auth/sessionGuard', () => ({
  captureSession: () => () => session.same,
  isSameSession: (check: (() => boolean) | undefined) => check?.() === true,
}))

type V = { name: string; city: string }
const FIELDS = ['name', 'city'] as const
const validate = (v: V) => ({ name: v.name ? undefined : 'Nome obrigatório' })

function Harness(props: Partial<UseAccountFormOptions<'name' | 'city', V, string>> & { request: (v: V) => Promise<string> }) {
  const form = useAccountForm<'name' | 'city', V, string>({
    fields: FIELDS,
    initial: { name: '', city: '' },
    validate,
    ...props,
  })
  return (
    <form onSubmit={form.onSubmit} noValidate>
      <input aria-label="name" {...form.field('name')} />
      <input aria-label="city" {...form.field('city')} />
      <button type="submit">enviar</button>
      <button type="button" onClick={() => form.reset({ name: 'zerado', city: '' })}>
        zerar
      </button>
      <output data-testid="state">
        {JSON.stringify({ errors: form.errors, api: form.apiErrors, form: form.formError, submitting: form.submitting })}
      </output>
    </form>
  )
}

const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}') as {
  errors: Record<string, string>
  api: Record<string, string>
  form?: string
  submitting: boolean
}
const input = (name: string) => screen.getByLabelText<HTMLInputElement>(name)
const type = (name: string, value: string) => fireEvent.change(input(name), { target: { value } })
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'enviar' }))

beforeEach(() => {
  session.same = true
})

describe('useAccountForm', () => {
  it('valida antes de enviar: sem request, erro no campo e foco nele', () => {
    const request = vi.fn()
    renderWithProviders(<Harness request={request} />)
    submit()
    expect(request).not.toHaveBeenCalled()
    expect(state().errors).toEqual({ name: 'Nome obrigatório' })
    expect(document.activeElement).toBe(input('name'))
  })

  it('editar o campo limpa o erro dele (e só dele); editar outro campo sem erro não mexe', () => {
    renderWithProviders(<Harness request={vi.fn()} />)
    submit()
    type('city', 'x')
    expect(state().errors).toEqual({ name: 'Nome obrigatório' })
    type('name', 'a')
    expect(state().errors.name).toBeUndefined()
  })

  it('editar o campo que veio com erro do servidor limpa esse erro', async () => {
    const request = vi.fn().mockRejectedValue(new ApiError({ code: 'validation', message: 'x', fieldErrors: { city: 'Cidade inválida' } }, 422))
    renderWithProviders(<Harness request={request} />)
    type('name', 'Ana')
    submit()
    await waitFor(() => expect(state().api).toEqual({ city: 'Cidade inválida' }))
    type('name', 'Ana B')
    expect(state().api).toEqual({ city: 'Cidade inválida' })
    type('city', 'Rio')
    expect(state().api.city).toBeUndefined()
  })

  it('sucesso: envia os valores, chama onSuccess e volta a aceitar envio', async () => {
    const request = vi.fn().mockResolvedValue('ok')
    const onSuccess = vi.fn()
    renderWithProviders(<Harness request={request} onSuccess={onSuccess} />)
    type('name', 'Ana')
    submit()
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('ok', { name: 'Ana', city: '' }))
    expect(request.mock.calls[0]?.[0]).toEqual({ name: 'Ana', city: '' })
    await waitFor(() => expect(state().submitting).toBe(false))
  })

  it('sem onSuccess o sucesso é silencioso', async () => {
    const request = vi.fn().mockResolvedValue('ok')
    renderWithProviders(<Harness request={request} />)
    type('name', 'Ana')
    submit()
    await waitFor(() => expect(request).toHaveBeenCalled())
    await waitFor(() => expect(state().submitting).toBe(false))
  })

  it('busyAfterSuccess mantém o formulário ocupado e ignora novo envio', async () => {
    const request = vi.fn().mockResolvedValue('ok')
    renderWithProviders(<Harness request={request} busyAfterSuccess />)
    type('name', 'Ana')
    submit()
    await waitFor(() => expect(state().submitting).toBe(true))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    submit()
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('422 com campo conhecido vira erro de campo e foca o campo', async () => {
    const request = vi.fn().mockRejectedValue(new ApiError({ code: 'validation', message: 'x', fieldErrors: { city: 'Cidade inválida' } }, 422))
    renderWithProviders(<Harness request={request} />)
    type('name', 'Ana')
    submit()
    await waitFor(() => expect(state().api).toEqual({ city: 'Cidade inválida' }))
    expect(state().form).toBeUndefined()
    expect(document.activeElement).toBe(input('city'))
  })

  it('erro genérico vira alerta do formulário e devolve o foco ao primeiro campo', async () => {
    const request = vi.fn().mockRejectedValue(new Error('rede'))
    renderWithProviders(<Harness request={request} />)
    type('name', 'Ana')
    type('city', 'Rio')
    input('city').focus()
    submit()
    await waitFor(() => expect(state().form).toBeTruthy())
    expect(document.activeElement).toBe(input('name'))
  })

  it('401 usa a mensagem passada; conflito cai no campo indicado', async () => {
    const request = vi.fn().mockRejectedValueOnce(new ApiError({ code: 'unauthorized', message: 'x' }, 401))
    renderWithProviders(<Harness request={request} unauthorizedMessage="Sessão expirada" conflictField="city" />)
    type('name', 'Ana')
    submit()
    await waitFor(() => expect(state().form).toBe('Sessão expirada'))
    request.mockRejectedValueOnce(new ApiError({ code: 'conflict', message: 'Já existe' }, 409))
    submit()
    await waitFor(() => expect(state().api).toEqual({ city: 'Já existe' }))
    expect(state().form).toBeUndefined()
  })

  it('erro de formulário sem nenhum campo declarado não tenta focar', async () => {
    const request = vi.fn().mockRejectedValue(new Error('rede'))
    renderWithProviders(<Harness request={request} fields={[]} validate={() => ({})} />)
    submit()
    await waitFor(() => expect(state().form).toBeTruthy())
  })

  it('sessão trocada com a request em voo: onSuccess não roda e o formulário não muda', async () => {
    let resolve!: (v: string) => void
    const request = vi.fn(() => new Promise<string>((r) => (resolve = r)))
    const onSuccess = vi.fn()
    renderWithProviders(<Harness request={request} onSuccess={onSuccess} />)
    type('name', 'Ana')
    submit()
    await waitFor(() => expect(request).toHaveBeenCalled())
    session.same = false
    resolve('ok')
    await waitFor(() => expect(state().submitting).toBe(false))
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('sessão trocada com a request em voo: a falha não vira erro na tela', async () => {
    let reject!: (e: unknown) => void
    const request = vi.fn(() => new Promise<string>((_, r) => (reject = r)))
    renderWithProviders(<Harness request={request} />)
    type('name', 'Ana')
    submit()
    await waitFor(() => expect(request).toHaveBeenCalled())
    session.same = false
    reject(new Error('x'))
    await waitFor(() => expect(state().submitting).toBe(false))
    expect(state().form).toBeUndefined()
    expect(state().api).toEqual({})
  })

  it('reset volta aos valores dados e limpa os erros', () => {
    renderWithProviders(<Harness request={vi.fn()} />)
    submit()
    fireEvent.click(screen.getByRole('button', { name: 'zerar' }))
    expect(input('name').value).toBe('zerado')
    expect(state().errors).toEqual({})
  })
})
