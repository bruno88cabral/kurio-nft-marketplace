// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { profileKeys } from '@/api/profile'
import { ApiError, type Profile } from '@/contracts'
import { renderWithProviders } from '@/test/render'
import { bumpSession, guardChecks } from '@/test/sessionGuardMock'
import { ProfileForm, ProfileFormSkeleton } from './ProfileForm'
import { PROFILE_UPDATED_MESSAGE } from './validation'

const { updateProfile, success } = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  success: vi.fn(),
}))

vi.mock('@/api/profile', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api/profile')>()), updateProfile }))
vi.mock('sonner', () => ({ toast: { success } }))
vi.mock('@/auth/sessionGuard', async () => (await import('@/test/sessionGuardMock')).sessionGuardMock())

const PROFILE: Profile = { accountId: 'user-ana', displayName: 'Ana Souza', wallets: [] }
const name = () => screen.getByLabelText<HTMLInputElement>(/^Nome de exibição/)
const save = () => screen.getByRole<HTMLButtonElement>('button', { name: /^Salvar|^Salvando/ })
const type = (value: string) => fireEvent.change(name(), { target: { value } })

beforeEach(() => {
  updateProfile.mockReset()
  success.mockReset()
})

describe('ProfileForm', () => {
  it('carrega o nome e o e-mail só leitura; "Salvar" só habilita quando o nome muda', () => {
    renderWithProviders(<ProfileForm profile={PROFILE} email="ana@kurio.test" />)
    expect(name().value).toBe('Ana Souza')
    expect(screen.getByText('9 de 60 caracteres')).toBeTruthy()
    const email = screen.getByLabelText<HTMLInputElement>('E-mail')
    expect(email.value).toBe('ana@kurio.test')
    expect(email.readOnly).toBe(true)
    expect(save().disabled).toBe(true)
    type('Ana S.')
    expect(save().disabled).toBe(false)
    expect(screen.getByText('6 de 60 caracteres')).toBeTruthy()
  })

  it('sucesso: envia o nome sem espaços, grava no cache, avisa e fica sem alterações', async () => {
    const next: Profile = { ...PROFILE, displayName: 'Ana Lima' }
    updateProfile.mockResolvedValue(next)
    const { queryClient } = renderWithProviders(<ProfileForm profile={PROFILE} email="ana@kurio.test" />)
    type('  Ana Lima ')
    fireEvent.click(save())
    await waitFor(() => expect(success).toHaveBeenCalledWith(PROFILE_UPDATED_MESSAGE))
    expect(updateProfile).toHaveBeenCalledWith({ displayName: 'Ana Lima' })
    expect(queryClient.getQueryData(profileKeys.detail('user-ana'))).toEqual(next)
    expect(name().value).toBe('Ana Lima')
  })

  it('durante o envio o botão mostra "Salvando…" e o campo fica só leitura', async () => {
    updateProfile.mockReturnValue(new Promise(() => undefined))
    renderWithProviders(<ProfileForm profile={PROFILE} email="ana@kurio.test" />)
    type('Outro')
    fireEvent.click(save())
    await waitFor(() => expect(save().textContent).toContain('Salvando…'))
    expect(save().disabled).toBe(true)
    expect(save().getAttribute('aria-busy')).toBe('true')
    expect(name().readOnly).toBe(true)
    // Enter no campo com o envio em curso (o botão desabilitado não segura o submit do formulário)
    fireEvent.submit(name().closest('form')!)
    expect(updateProfile).toHaveBeenCalledTimes(1)
  })

  it('422 do servidor volta no campo; falha genérica vira alerta; sem toast', async () => {
    updateProfile.mockRejectedValueOnce(new ApiError({ code: 'validation', message: 'x', fieldErrors: { displayName: 'Nome já usado' } }, 422))
    renderWithProviders(<ProfileForm profile={PROFILE} email="ana@kurio.test" />)
    type('Outro')
    fireEvent.click(save())
    expect(await screen.findByText('Nome já usado')).toBeTruthy()
    updateProfile.mockRejectedValueOnce(new Error('rede'))
    fireEvent.click(save())
    expect((await screen.findByRole('alert')).textContent).toBeTruthy()
    expect(success).not.toHaveBeenCalled()
  })

  it('sessão trocada com a request em voo: sem toast nem escrita no cache', async () => {
    let resolve!: (p: Profile) => void
    updateProfile.mockReturnValue(new Promise<Profile>((r) => (resolve = r)))
    const { queryClient } = renderWithProviders(<ProfileForm profile={PROFILE} email="ana@kurio.test" />)
    type('Outro')
    fireEvent.click(save())
    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    bumpSession()
    resolve({ ...PROFILE, displayName: 'Outro' })
    await waitFor(() => expect(guardChecks()).toEqual([false]))
    expect(success).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(profileKeys.detail('user-ana'))).toBeUndefined()
  })

  it('sessão trocada com a request em voo: a falha não vira alerta nem erro de campo', async () => {
    let reject!: (e: unknown) => void
    updateProfile.mockReturnValue(new Promise<Profile>((_, r) => (reject = r)))
    renderWithProviders(<ProfileForm profile={PROFILE} email="ana@kurio.test" />)
    type('Outro')
    fireEvent.click(save())
    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    bumpSession()
    reject(new ApiError({ code: 'validation', message: 'x', fieldErrors: { displayName: 'Nome já usado' } }, 422))
    await waitFor(() => expect(guardChecks()).toEqual([false]))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('Nome já usado')).toBeNull()
  })
})

describe('ProfileFormSkeleton', () => {
  it('é decorativo (aria-hidden)', () => {
    const { container } = renderWithProviders(<ProfileFormSkeleton />)
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  })
})
