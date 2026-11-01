// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/contracts'
import { renderWithProviders } from '@/test/render'
import { navigateSpy } from '@/test/routerMock'
import { SignupForm } from './SignupForm'
import { SIGNUP_CONFLICT_MESSAGE } from './validation'

const { signup, establishSession } = vi.hoisted(() => ({ signup: vi.fn(), establishSession: vi.fn() }))

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
vi.mock('@/api/auth', () => ({ signup }))
vi.mock('@/auth/sessionLifecycle', () => ({
  sessionLifecycle: { establishSession, captureSession: () => () => true },
}))

const AUTH = { token: 't', expiresAt: '2099-01-01T00:00:00.000Z', account: { id: 'user-carla', email: 'carla@kurio.test', name: 'Carla' } }

const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`))
const typeInto = (label: string, value: string) => fireEvent.change(field(label), { target: { value } })
const submit = () => fireEvent.click(screen.getByRole('button', { name: /Criar conta|Criando conta/ }))
const preencher = (email = 'carla@kurio.test') => {
  typeInto('Nome', ' Carla ')
  typeInto('E-mail', ` ${email} `)
  typeInto('Senha', 'Kurio#2026')
  typeInto('Confirmar senha', 'Kurio#2026')
}

beforeEach(() => {
  signup.mockReset()
  establishSession.mockReset()
})

describe('SignupForm', () => {
  it('envio vazio mostra 4 erros, foca o nome e não chama a API', () => {
    renderWithProviders(<SignupForm redirect={undefined} />)
    submit()
    expect(screen.getAllByText(/^Informe|^Confirme/)).toHaveLength(4)
    expect(document.activeElement).toBe(field('Nome'))
    expect(signup).not.toHaveBeenCalled()
  })

  it('foca o primeiro campo inválido (e-mail) quando o nome está certo', () => {
    renderWithProviders(<SignupForm redirect={undefined} />)
    typeInto('Nome', 'Carla')
    submit()
    expect(document.activeElement).toBe(field('E-mail'))
  })

  it('409 mostra a mensagem no e-mail e o link "Entrar com este e-mail" mantém o redirect', async () => {
    signup.mockRejectedValue(new ApiError({ code: 'conflict', message: 'dup' }, 409))
    renderWithProviders(<SignupForm redirect="/cart" />)
    preencher('ana@kurio.test')
    submit()
    expect(await screen.findByText(SIGNUP_CONFLICT_MESSAGE)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Entrar com este e-mail' }).getAttribute('href')).toBe('/login?redirect=%2Fcart')
    expect(document.activeElement).toBe(field('E-mail'))
    expect(establishSession).not.toHaveBeenCalled()
  })

  it('sem conflito não mostra o link de entrar com o e-mail', () => {
    renderWithProviders(<SignupForm redirect={undefined} />)
    expect(screen.queryByRole('link', { name: 'Entrar com este e-mail' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Entre' }).getAttribute('href')).toBe('/login')
  })

  it('sucesso: envia sem espaços, estabelece a sessão e navega ao redirect', async () => {
    signup.mockResolvedValue(AUTH)
    renderWithProviders(<SignupForm redirect="/cart" />)
    preencher()
    submit()
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith({ href: '/cart', replace: true }))
    expect(signup).toHaveBeenCalledWith({ name: 'Carla', email: 'carla@kurio.test', password: 'Kurio#2026' })
    expect(establishSession).toHaveBeenCalledWith(AUTH)
    expect((screen.getByRole<HTMLButtonElement>('button', { name: 'Criando conta…' })).disabled).toBe(true)
  })
})
