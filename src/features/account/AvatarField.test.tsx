// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { profileKeys } from '@/api/profile'
import { ApiError, type Profile } from '@/contracts'
import { renderWithProviders } from '@/test/render'
import { bumpSession, guardChecks } from '@/test/sessionGuardMock'
import { AvatarField } from './AvatarField'
import { AVATAR_MESSAGES, MAX_AVATAR_BYTES } from './avatar'
import { PROFILE_UPDATED_MESSAGE } from './validation'

const { updateProfile, success } = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  success: vi.fn(),
}))

vi.mock('@/api/profile', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/api/profile')>()), updateProfile }))
vi.mock('sonner', () => ({ toast: { success } }))
vi.mock('@/auth/sessionGuard', async () => (await import('@/test/sessionGuardMock')).sessionGuardMock())

const PLAIN: Profile = { accountId: 'user-ana', displayName: 'Ana Souza', wallets: [] }
const WITH_AVATAR: Profile = { ...PLAIN, avatarUrl: 'data:image/png;base64,AAAA' }
const PNG = () => new File(['abc'], 'a.png', { type: 'image/png' })

const input = () => document.querySelector('input[type="file"]') as HTMLInputElement
const choose = (file?: File) => fireEvent.change(input(), { target: { files: file ? [file] : [] } })

beforeEach(() => {
  updateProfile.mockReset()
  success.mockReset()
})
afterEach(() => vi.restoreAllMocks())

describe('AvatarField', () => {
  it('sem imagem: iniciais, sem "Remover avatar", dica de formato', () => {
    renderWithProviders(<AvatarField profile={PLAIN} />)
    expect(screen.getByRole('img', { name: 'Avatar de Ana Souza' }).textContent).toBe('AS')
    expect(screen.queryByRole('button', { name: /Remover avatar/ })).toBeNull()
    expect(screen.getByText('PNG, JPEG, WebP ou GIF, até 140 KB.')).toBeTruthy()
    expect(input().getAttribute('accept')).toContain('image/png')
  })

  it('nome sem iniciais mostra o ícone no lugar do texto', () => {
    renderWithProviders(<AvatarField profile={{ ...PLAIN, displayName: '   ' }} />)
    expect(screen.getByRole('img', { name: /^Avatar de/ }).textContent).toBe('')
  })

  it('com imagem oferece "Remover avatar"', () => {
    renderWithProviders(<AvatarField profile={WITH_AVATAR} />)
    expect(screen.getByRole('button', { name: /Remover avatar/ })).toBeTruthy()
  })

  it('cancelar o seletor (nenhum arquivo) não faz nada', () => {
    renderWithProviders(<AvatarField profile={PLAIN} />)
    choose()
    expect(updateProfile).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('tipo errado e arquivo grande mostram o erro sem request; o erro some com um arquivo bom', async () => {
    updateProfile.mockResolvedValue({ ...PLAIN, avatarUrl: 'x' })
    renderWithProviders(<AvatarField profile={PLAIN} />)
    choose(new File(['x'], 'a.pdf', { type: 'application/pdf' }))
    expect((await screen.findByRole('alert')).textContent).toContain(AVATAR_MESSAGES.invalidType)
    expect(input().getAttribute('aria-invalid')).toBe('true')
    const big = new File(['x'], 'b.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: MAX_AVATAR_BYTES + 1 })
    choose(big)
    expect((await screen.findByRole('alert')).textContent).toContain(AVATAR_MESSAGES.tooLarge)
    expect(updateProfile).not.toHaveBeenCalled()
    choose(PNG())
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('arquivo válido manda o data URL, grava no cache e avisa', async () => {
    const next = { ...PLAIN, avatarUrl: 'data:image/png;base64,YWJj' }
    updateProfile.mockResolvedValue(next)
    const { queryClient } = renderWithProviders(<AvatarField profile={PLAIN} />)
    choose(PNG())
    await waitFor(() => expect(success).toHaveBeenCalledWith(PROFILE_UPDATED_MESSAGE))
    expect(updateProfile).toHaveBeenCalledWith({ avatarUrl: 'data:image/png;base64,YWJj' })
    expect(queryClient.getQueryData(profileKeys.detail('user-ana'))).toEqual(next)
  })

  it('falha na leitura do arquivo mostra a mensagem de leitura', async () => {
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>)
    })
    renderWithProviders(<AvatarField profile={PLAIN} />)
    choose(PNG())
    expect((await screen.findByRole('alert')).textContent).toContain(AVATAR_MESSAGES.readFailed)
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('durante o envio os controles ficam ocupados', async () => {
    updateProfile.mockReturnValue(new Promise(() => undefined))
    renderWithProviders(<AvatarField profile={WITH_AVATAR} />)
    choose(PNG())
    await waitFor(() => expect(input().disabled).toBe(true))
    expect((screen.getByRole<HTMLButtonElement>('button', { name: /Remover avatar/ })).disabled).toBe(true)
  })

  it('remover envia avatarUrl vazio e devolve o foco ao seletor depois', async () => {
    let resolve!: (p: Profile) => void
    updateProfile.mockReturnValue(new Promise<Profile>((r) => (resolve = r)))
    const { queryClient } = renderWithProviders(<AvatarField profile={WITH_AVATAR} />)
    fireEvent.click(screen.getByRole('button', { name: /Remover avatar/ }))
    await waitFor(() => expect(input().disabled).toBe(true))
    resolve(PLAIN)
    await waitFor(() => expect(success).toHaveBeenCalledWith(PROFILE_UPDATED_MESSAGE))
    expect(updateProfile).toHaveBeenCalledWith({ avatarUrl: '' })
    expect(queryClient.getQueryData(profileKeys.detail('user-ana'))).toEqual(PLAIN)
    await waitFor(() => expect(document.activeElement).toBe(input()))
  })

  it('enviar um arquivo (não remover) não puxa o foco para o seletor', async () => {
    let resolve!: (p: Profile) => void
    updateProfile.mockReturnValue(new Promise<Profile>((r) => (resolve = r)))
    renderWithProviders(<AvatarField profile={PLAIN} />)
    choose(PNG())
    await waitFor(() => expect(input().disabled).toBe(true))
    resolve({ ...PLAIN, avatarUrl: 'x' })
    await waitFor(() => expect(success).toHaveBeenCalled())
    await waitFor(() => expect(input().disabled).toBe(false))
    expect(document.activeElement).not.toBe(input())
  })

  it('erro de campo (422) e 401 aparecem como alerta', async () => {
    updateProfile.mockRejectedValueOnce(new ApiError({ code: 'validation', message: 'x', fieldErrors: { avatarUrl: 'Imagem recusada.' } }, 422))
    renderWithProviders(<AvatarField profile={WITH_AVATAR} />)
    fireEvent.click(screen.getByRole('button', { name: /Remover avatar/ }))
    expect((await screen.findByRole('alert')).textContent).toContain('Imagem recusada.')
    updateProfile.mockRejectedValueOnce(new ApiError({ code: 'unauthorized', message: 'x' }, 401))
    fireEvent.click(screen.getByRole('button', { name: /Remover avatar/ }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('sessão'))
  })

  it('sessão trocada com a request em voo: sem toast nem cache (sucesso)', async () => {
    let resolve!: (p: Profile) => void
    updateProfile.mockReturnValueOnce(new Promise<Profile>((r) => (resolve = r)))
    const { queryClient } = renderWithProviders(<AvatarField profile={WITH_AVATAR} />)
    fireEvent.click(screen.getByRole('button', { name: /Remover avatar/ }))
    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    bumpSession()
    resolve(PLAIN)
    await waitFor(() => expect(guardChecks()).toEqual([false]))
    expect(success).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(profileKeys.detail('user-ana'))).toBeUndefined()
  })

  it('sessão trocada com a request em voo: a falha não vira alerta', async () => {
    let reject!: (e: unknown) => void
    updateProfile.mockReturnValueOnce(new Promise<Profile>((_, r) => (reject = r)))
    renderWithProviders(<AvatarField profile={WITH_AVATAR} />)
    fireEvent.click(screen.getByRole('button', { name: /Remover avatar/ }))
    await waitFor(() => expect(updateProfile).toHaveBeenCalled())
    bumpSession()
    reject(new Error('x'))
    await waitFor(() => expect(guardChecks()).toEqual([false]))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
