// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type Profile } from '@/contracts'

const api = vi.hoisted(() => ({ updateProfile: vi.fn(), changePassword: vi.fn() }))
vi.mock('@/api/profile', () => ({
  profileKeys: { detail: (id: string) => ['profile', id] },
  updateProfile: api.updateProfile,
  changePassword: api.changePassword,
}))
vi.mock('@/auth/sessionLifecycle', () => ({
  SESSION_EXPIRED_MESSAGE: 'Sua sessão expirou. Entre novamente.',
  sessionLifecycle: { captureSession: () => () => true },
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const { ProfileForm } = await import('./ProfileForm')

const PROFILE: Profile = { accountId: 'user-ana', displayName: 'Ana Souza', wallets: [] }

afterEach(cleanup)
beforeEach(() => {
  api.updateProfile.mockReset()
  api.changePassword.mockReset()
  toast.success.mockReset()
})

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ProfileForm profile={PROFILE} email="ana@kurio.test" />
    </QueryClientProvider>,
  )
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const save = () => screen.getByRole('button', { name: 'Salvar' })

describe('ProfileForm (Perfil do colecionador, Salvar único)', () => {
  it('sem mudança, "Salvar" fica desabilitado e não há "Alterar senha" separado', () => {
    renderForm()
    expect((save() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Alterar senha' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Alterar senha' })).toBeTruthy()
  })

  it('só o nome mudou: envia só o perfil', async () => {
    api.updateProfile.mockResolvedValue({ ...PROFILE, displayName: 'Ana S.' })
    renderForm()
    type(/Nome de exibição/, 'Ana S.')
    fireEvent.click(save())
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledWith({ displayName: 'Ana S.' }))
    expect(api.changePassword).not.toHaveBeenCalled()
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Perfil atualizado.'))
  })

  it('só a senha preenchida: envia só a troca de senha', async () => {
    api.changePassword.mockResolvedValue(undefined)
    renderForm()
    type('Senha atual', 'Kurio#2026')
    type('Nova senha', 'NovaSenha#1')
    type('Confirmar nova senha', 'NovaSenha#1')
    fireEvent.click(save())
    await waitFor(() =>
      expect(api.changePassword).toHaveBeenCalledWith({ currentPassword: 'Kurio#2026', newPassword: 'NovaSenha#1' }),
    )
    expect(api.updateProfile).not.toHaveBeenCalled()
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Senha alterada.'))
  })

  it('erro de cliente em qualquer um dos dois: nada é enviado e o foco vai ao primeiro campo inválido', () => {
    renderForm()
    type(/Nome de exibição/, '   ')
    type('Senha atual', 'Kurio#2026')
    type('Nova senha', 'NovaSenha#1')
    type('Confirmar nova senha', 'outra')
    fireEvent.click(save())
    expect(api.updateProfile).not.toHaveBeenCalled()
    expect(api.changePassword).not.toHaveBeenCalled()
    const name = screen.getByRole('textbox', { name: /Nome de exibição/, description: /Informe um nome de exibição\./ })
    expect(document.activeElement).toBe(name)
    expect(screen.getByLabelText('Confirmar nova senha', { selector: 'input' }).getAttribute('aria-invalid')).toBe('true')
  })

  it('nome válido e senha inválida: o perfil também não é enviado', () => {
    renderForm()
    type(/Nome de exibição/, 'Ana S.')
    type('Nova senha', 'curta')
    fireEvent.click(save())
    expect(api.updateProfile).not.toHaveBeenCalled()
    expect(api.changePassword).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByLabelText('Senha atual', { selector: 'input' }))
  })

  it('"Senha atual incorreta." da API volta no campo, e o perfil enviado junto é salvo', async () => {
    api.updateProfile.mockResolvedValue({ ...PROFILE, displayName: 'Ana S.' })
    api.changePassword.mockRejectedValue(
      new ApiError({ code: 'validation', message: 'Dados inválidos.', fieldErrors: { currentPassword: 'Senha atual incorreta.' } }, 422),
    )
    renderForm()
    type(/Nome de exibição/, 'Ana S.')
    type('Senha atual', 'errada123')
    type('Nova senha', 'NovaSenha#1')
    type('Confirmar nova senha', 'NovaSenha#1')
    fireEvent.click(save())
    await waitFor(() =>
      expect(screen.getByLabelText('Senha atual', { selector: 'input' }).getAttribute('aria-invalid')).toBe('true'),
    )
    expect(screen.getByText('Senha atual incorreta.')).toBeTruthy()
    expect(api.updateProfile).toHaveBeenCalledWith({ displayName: 'Ana S.' })
    expect(toast.success).toHaveBeenCalledWith('Perfil atualizado.')
  })
})
