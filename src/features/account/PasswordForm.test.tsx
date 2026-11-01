// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/contracts'
import { renderWithProviders } from '@/test/render'
import { PasswordFields } from './PasswordForm'
import { usePasswordForm } from './usePasswordForm'
import { PASSWORD_CHANGED_MESSAGE } from './validation'

const { changePassword, success } = vi.hoisted(() => ({ changePassword: vi.fn(), success: vi.fn() }))

vi.mock('@/api/profile', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api/profile')>()), changePassword }))
vi.mock('sonner', () => ({ toast: { success } }))

const field = (label: string) => screen.getByLabelText<HTMLInputElement>(new RegExp(`^${label}`))
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } })
const submit = () => fireEvent.click(screen.getByRole('button', { name: /^Alterar senha|^Alterando/ }))
const fill = (current: string, next: string, confirm: string) => {
  type('Senha atual', current)
  type('Nova senha', next)
  type('Confirmar nova senha', confirm)
}

// O envio é do "Salvar" único do Perfil (ProfileForm); aqui um formulário mínimo liga os campos ao hook
function PasswordForm({ email }: { email: string }) {
  const form = usePasswordForm()
  return (
    <form noValidate onSubmit={form.onSubmit}>
      <PasswordFields form={form} email={email} />
      <button type="submit" disabled={form.submitting} aria-busy={form.submitting || undefined}>
        {form.submitting ? 'Alterando…' : 'Alterar senha'}
      </button>
      <output data-testid="touched">{String(form.touched)}</output>
    </form>
  )
}

beforeEach(() => {
  changePassword.mockReset()
  success.mockReset()
})

describe('PasswordFields + usePasswordForm', () => {
  it('touched só com algum campo preenchido', () => {
    renderWithProviders(<PasswordForm email="ana@kurio.test" />)
    expect(screen.getByTestId('touched').textContent).toBe('false')
    type('Nova senha', 'x')
    expect(screen.getByTestId('touched').textContent).toBe('true')
  })

  it('envio vazio mostra os três erros, foca a senha atual e não chama a API', () => {
    renderWithProviders(<PasswordForm email="ana@kurio.test" />)
    submit()
    expect(screen.getByText('Informe a senha atual.')).toBeTruthy()
    expect(screen.getByText('Confirme sua senha.')).toBeTruthy()
    expect(document.activeElement).toBe(field('Senha atual'))
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('senhas diferentes: erro na confirmação, sem request', () => {
    renderWithProviders(<PasswordForm email="ana@kurio.test" />)
    fill('Kurio#2026', 'Nova#2027ab', 'Outra#2027ab')
    submit()
    expect(screen.getByText('As senhas não conferem.')).toBeTruthy()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('senha atual errada (422) volta no campo', async () => {
    changePassword.mockRejectedValue(
      new ApiError({ code: 'validation', message: 'x', fieldErrors: { currentPassword: 'Senha atual incorreta.' } }, 422),
    )
    renderWithProviders(<PasswordForm email="ana@kurio.test" />)
    fill('Errada#2026', 'Nova#2027ab', 'Nova#2027ab')
    submit()
    expect(await screen.findByText('Senha atual incorreta.')).toBeTruthy()
    expect(document.activeElement).toBe(field('Senha atual'))
    expect(success).not.toHaveBeenCalled()
  })

  it('sucesso: envia atual e nova, limpa os campos e avisa', async () => {
    changePassword.mockResolvedValue(undefined)
    renderWithProviders(<PasswordForm email="ana@kurio.test" />)
    fill('Kurio#2026', 'Nova#2027ab', 'Nova#2027ab')
    submit()
    await waitFor(() => expect(success).toHaveBeenCalledWith(PASSWORD_CHANGED_MESSAGE))
    expect(changePassword).toHaveBeenCalledWith({ currentPassword: 'Kurio#2026', newPassword: 'Nova#2027ab' })
    expect(field('Senha atual').value).toBe('')
    expect(field('Nova senha').value).toBe('')
    expect(field('Confirmar nova senha').value).toBe('')
  })

  it('durante o envio mostra "Alterando…" desabilitado', async () => {
    changePassword.mockReturnValue(new Promise(() => undefined))
    renderWithProviders(<PasswordForm email="ana@kurio.test" />)
    fill('Kurio#2026', 'Nova#2027ab', 'Nova#2027ab')
    submit()
    const button = await screen.findByRole<HTMLButtonElement>('button', { name: /Alterando/ })
    expect(button.disabled).toBe(true)
    expect(field('Senha atual').readOnly).toBe(true)
    expect(field('Nova senha').readOnly).toBe(true)
    expect(field('Confirmar nova senha').readOnly).toBe(true)
  })

  it('o e-mail oculto ajuda o gerenciador de senhas', () => {
    const { container } = renderWithProviders(<PasswordForm email="ana@kurio.test" />)
    expect((container.querySelector('input[name="username"]') as HTMLInputElement).value).toBe('ana@kurio.test')
  })
})
