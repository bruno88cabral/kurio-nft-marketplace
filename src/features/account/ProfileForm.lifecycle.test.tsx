// @vitest-environment jsdom
// Integração com o ciclo de vida REAL: nem `@/auth/sessionGuard` nem `@/auth/sessionLifecycle` são mockados.
// Usa o singleton do app (`sessionLifecycle`); só a API e o toast são simulados.
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { profileKeys } from '@/api/profile'
import { sessionLifecycle } from '@/auth/sessionLifecycle'
import type { Profile } from '@/contracts'
import { renderWithProviders } from '@/test/render'
import { ProfileForm } from './ProfileForm'

const { updateProfile, success } = vi.hoisted(() => ({ updateProfile: vi.fn(), success: vi.fn() }))

vi.mock('@/api/profile', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api/profile')>()), updateProfile }))
vi.mock('sonner', () => ({ toast: { success, error: vi.fn() } }))

const PROFILE: Profile = { accountId: 'user-ana', displayName: 'Ana Souza', wallets: [] }

beforeEach(() => {
  updateProfile.mockReset()
  success.mockReset()
})

describe('ProfileForm com o ciclo de vida real', () => {
  const start = () => {
    const view = renderWithProviders(<ProfileForm profile={PROFILE} email="ana@kurio.test" />)
    fireEvent.change(screen.getByLabelText(/^Nome de exibição/), { target: { value: 'Outro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    return view
  }

  it('reset da sessão com a request em voo: a resposta não gera toast nem escreve no cache', async () => {
    let resolve!: (p: Profile) => void
    updateProfile.mockReturnValue(new Promise<Profile>((r) => (resolve = r)))
    const { queryClient } = start()
    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    await act(() => sessionLifecycle.resetPrivateState())
    resolve({ ...PROFILE, displayName: 'Outro' })
    // o botão volta a "Salvar" só depois de o onSuccess ter rodado (e saído pela guarda)
    await waitFor(() => expect(screen.getByRole('button', { name: /Salvar/ }).getAttribute('aria-busy')).toBeNull())
    expect(success).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(profileKeys.detail('user-ana'))).toBeUndefined()
  })

  it('sem troca de sessão o mesmo fluxo avisa e grava (controle)', async () => {
    updateProfile.mockResolvedValue({ ...PROFILE, displayName: 'Outro' })
    const { queryClient } = start()
    await waitFor(() => expect(success).toHaveBeenCalledWith('Perfil atualizado.'))
    expect(queryClient.getQueryData(profileKeys.detail('user-ana'))).toEqual({ ...PROFILE, displayName: 'Outro' })
  })
})
