// @vitest-environment jsdom
import { queryOptions } from '@tanstack/react-query'
import { act, fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from '@/contracts'
import { renderWithProviders } from '@/test/render'
import { ANA, sessionOf } from '@/test/session'
import { Route } from './profile'

const { useSession, fetchProfile } = vi.hoisted(() => ({ useSession: vi.fn(), fetchProfile: vi.fn() }))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return (await import('@/test/routerMock')).routeModuleMock(actual)
})
vi.mock('@/auth/useSession', () => ({ useSession }))
vi.mock('@/api/profile', () => ({
  profileQuery: (accountId: string) => queryOptions({ queryKey: ['profile', accountId], queryFn: fetchProfile }),
}))
vi.mock('@/features/account/ProfileForm', () => ({
  ProfileForm: ({ profile, email }: { profile: Profile; email: string }) => <p>form de {profile.displayName} ({email})</p>,
  ProfileFormSkeleton: () => <p>skeleton do perfil</p>,
}))

const options = Route.options as unknown as { head: () => { meta: { title: string }[] }; component: () => React.ReactNode }
const PROFILE: Profile = { accountId: 'user-ana', displayName: 'Ana Souza', wallets: [] }

beforeEach(() => {
  useSession.mockReset().mockReturnValue(sessionOf(ANA))
  fetchProfile.mockReset()
})

describe('rota /profile', () => {
  it('head define o título', () => {
    expect(options.head().meta).toEqual([{ title: 'Perfil · Kurio' }])
  })

  it('carregando: título da conta e skeleton do perfil', () => {
    fetchProfile.mockReturnValue(new Promise(() => undefined))
    const Component = options.component
    renderWithProviders(<Component />)
    expect(screen.getByRole('heading', { level: 1, name: 'Perfil do colecionador' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Dados do perfil' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByText('skeleton do perfil')).toBeTruthy()
  })

  it('com o perfil carregado mostra o formulário com o e-mail da sessão', async () => {
    fetchProfile.mockResolvedValue(PROFILE)
    const Component = options.component
    renderWithProviders(<Component />)
    expect(await screen.findByText('form de Ana Souza (ana@kurio.test)')).toBeTruthy()
    expect(screen.queryByText('skeleton do perfil')).toBeNull()
  })

  it('erro: mostra o estado de erro e "Tentar novamente" refaz a busca', async () => {
    fetchProfile.mockRejectedValueOnce(new Error('falhou')).mockResolvedValue(PROFILE)
    const Component = options.component
    renderWithProviders(<Component />)
    expect(await screen.findByText('Não foi possível carregar seu perfil.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }))
    expect(await screen.findByText('form de Ana Souza (ana@kurio.test)')).toBeTruthy()
    expect(fetchProfile).toHaveBeenCalledTimes(2)
  })

  it('sem conta na sessão (logout em curso) não busca nem mostra o formulário', async () => {
    useSession.mockReturnValue(sessionOf(null))
    const Component = options.component
    renderWithProviders(<Component />)
    expect(screen.getByText('skeleton do perfil')).toBeTruthy()
    expect(screen.queryByText(/^form de/)).toBeNull()
    await act(async () => {}) // deixa efeitos e microtarefas assentarem antes da asserção negativa
    expect(fetchProfile).not.toHaveBeenCalled()
  })
})
