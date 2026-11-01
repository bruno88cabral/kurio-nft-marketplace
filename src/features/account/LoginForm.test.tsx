// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/contracts'
import { renderWithProviders } from '@/test/render'
import { navigateSpy } from '@/test/routerMock'
import { LoginForm, SocialLogin } from './LoginForm'

const { login, establishSession } = vi.hoisted(() => ({ login: vi.fn(), establishSession: vi.fn() }))

vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
vi.mock('@/api/auth', () => ({ login }))
vi.mock('@/auth/sessionLifecycle', () => ({
  sessionLifecycle: { establishSession, captureSession: () => () => true },
}))

const AUTH = { token: 't', expiresAt: '2099-01-01T00:00:00.000Z', account: { id: 'user-ana', email: 'ana@kurio.test', name: 'Ana Souza' } }

const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`))
const typeInto = (label: string, value: string) => fireEvent.change(field(label), { target: { value } })
const submit = () => fireEvent.click(screen.getByRole('button', { name: /Entrar|Entrando/ }))

beforeEach(() => {
  login.mockReset()
  establishSession.mockReset()
})

describe('LoginForm', () => {
  it('envio vazio mostra os erros, foca o e-mail e não chama a API', () => {
    renderWithProviders(<LoginForm redirect={undefined} />)
    submit()
    expect(screen.getByText('Informe seu e-mail.')).toBeTruthy()
    expect(screen.getByText('Informe sua senha.')).toBeTruthy()
    expect(document.activeElement).toBe(field('E-mail'))
    expect(login).not.toHaveBeenCalled()
  })

  it('credencial errada mostra o alerta e devolve o foco ao e-mail', async () => {
    login.mockRejectedValue(new ApiError({ code: 'unauthorized', message: 'x' }, 401))
    renderWithProviders(<LoginForm redirect={undefined} />)
    typeInto('E-mail', 'ana@kurio.test')
    typeInto('Senha', 'errada123')
    submit()
    expect((await screen.findByRole('alert')).textContent).toContain('E-mail ou senha inválidos.')
    expect(document.activeElement).toBe(field('E-mail'))
    expect(establishSession).not.toHaveBeenCalled()
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('erro editado some ao digitar', () => {
    renderWithProviders(<LoginForm redirect={undefined} />)
    submit()
    expect(screen.getByText('Informe seu e-mail.')).toBeTruthy()
    typeInto('E-mail', 'a')
    expect(screen.queryByText('Informe seu e-mail.')).toBeNull()
  })

  it('sucesso: tira espaços do e-mail, estabelece a sessão e navega ao redirect', async () => {
    login.mockResolvedValue(AUTH)
    renderWithProviders(<LoginForm redirect="/cart" />)
    typeInto('E-mail', '  ana@kurio.test ')
    typeInto('Senha', 'Kurio#2026')
    submit()
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith({ href: '/cart', replace: true }))
    expect(login).toHaveBeenCalledWith({ email: 'ana@kurio.test', password: 'Kurio#2026' })
    expect(establishSession).toHaveBeenCalledTimes(1)
    expect(establishSession).toHaveBeenCalledWith(AUTH)
    // continua ocupado até a rota trocar
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Entrando…' })
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
  })

  it('sem redirect navega para /', async () => {
    login.mockResolvedValue(AUTH)
    renderWithProviders(<LoginForm redirect={undefined} />)
    typeInto('E-mail', 'ana@kurio.test')
    typeInto('Senha', 'Kurio#2026')
    submit()
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith({ href: '/', replace: true }))
  })

  it('o link "Criar conta" leva ao cadastro preservando o redirect', () => {
    renderWithProviders(<LoginForm redirect="/cart" />)
    expect(screen.getByRole('link', { name: 'Criar conta' }).getAttribute('href')).toBe('/signup?redirect=%2Fcart')
  })

  it('"Esqueceu a senha?" e o login social são ações "em breve"', () => {
    renderWithProviders(<LoginForm redirect={undefined} />)
    expect(screen.getByRole('button', { name: /Esqueceu a senha/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Continuar com Google/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Continuar com Apple/ })).toBeTruthy()
  })
})

describe('SocialLogin', () => {
  it('renderiza o separador e as duas opções', () => {
    renderWithProviders(<SocialLogin />)
    expect(screen.getByText('ou')).toBeTruthy()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})
