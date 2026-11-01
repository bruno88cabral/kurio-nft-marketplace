// @vitest-environment jsdom
import { notFound, type ErrorComponentProps } from '@tanstack/react-router'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type Nft } from '@/contracts'
import { makeNft } from '@/test/nftFixtures'
import { createTestQueryClient, renderWithProviders } from '@/test/render'
import { invalidateSpy, navigateSpy } from '@/test/routerMock'
import { Route } from './nfts.$nftId'

// Rota real (createFileRoute/notFound de verdade) com os hooks do router mockados; as seções do Detalhe têm testes próprios
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  const mock = (await import('@/test/routerMock')).routerMock()
  return { ...actual, ...mock, createFileRoute: actual.createFileRoute, notFound: actual.notFound }
})
const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/client', () => ({ apiClient: api }))
vi.mock('@/features/nft-detail/MobileDetailChrome', () => ({
  MobileScreenHeader: ({ title }: { title: string }) => <p>header:{title}</p>,
  MobilePurchaseBar: ({ selection }: { selection: { edition?: { kind: string } } }) => <p>barra:{selection.edition?.kind}</p>,
}))
vi.mock('@/features/nft-detail/MoreFromCollection', () => ({ MoreFromCollection: () => <p>mais</p> }))
vi.mock('@/features/nft-detail/NftGallery', () => ({ NftGallery: () => <p>galeria</p> }))
vi.mock('@/features/nft-detail/NftInfo', () => ({
  NftBreadcrumb: () => <p>trilha</p>,
  NftInfo: ({ nft }: { nft: Nft }) => <h1>{nft.name}</h1>,
  NftDescription: ({ description }: { description: string }) => <p>{description}</p>,
}))
vi.mock('@/features/nft-detail/PurchasePanel', () => ({
  PurchasePanel: ({ onEditionChange }: { onEditionChange: (k: string) => void }) => (
    <button type="button" onClick={() => onEditionChange('open')}>
      trocar edição
    </button>
  ),
}))

const nft = makeNft(7, {
  name: 'Obra 7',
  description: 'desc',
  editions: [
    { kind: '1/10', available: 5, total: 10 },
    { kind: 'open', available: 9, total: 100 },
  ],
})

type Loader = (a: { context: { queryClient: ReturnType<typeof createTestQueryClient> }; params: { nftId: string } }) => Promise<unknown>
const options = Route.options as unknown as {
  validateSearch: (s: Record<string, unknown>) => { edition?: string }
  loader: Loader
  head: (a: { loaderData?: Nft }) => { meta: { title: string }[] }
  pendingComponent: () => ReactNode
  notFoundComponent: () => ReactNode
  errorComponent: (p: ErrorComponentProps) => ReactNode
  component: () => ReactNode
}

let search: Record<string, unknown>
beforeEach(() => {
  api.get.mockReset().mockResolvedValue({ data: nft })
  search = {}
  vi.spyOn(Route, 'useParams').mockReturnValue({ nftId: nft.id })
  vi.spyOn(Route, 'useSearch').mockImplementation((() => search) as never)
  vi.spyOn(Route, 'useNavigate').mockReturnValue(navigateSpy as never)
})

describe('rota /nfts/$nftId', () => {
  it('validateSearch mantém uma edição válida e descarta o resto', () => {
    expect(options.validateSearch({ edition: 'open' })).toEqual({ edition: 'open' })
    expect(options.validateSearch({ edition: 'zzz' })).toEqual({ edition: undefined })
    expect(options.validateSearch({})).toEqual({ edition: undefined })
  })

  it('head usa o nome do NFT e, sem dados, o título genérico', () => {
    expect(options.head({ loaderData: nft }).meta).toEqual([{ title: 'Obra 7 · Kurio' }])
    expect(options.head({}).meta).toEqual([{ title: 'NFT · Kurio' }])
  })

  it('loader aquece o cache e devolve o NFT', async () => {
    const queryClient = createTestQueryClient()
    await expect(options.loader({ context: { queryClient }, params: { nftId: nft.id } })).resolves.toEqual(nft)
    expect(api.get).toHaveBeenCalledWith(`/nfts/${nft.id}`, expect.anything())
    expect(queryClient.getQueryData(['nfts', 'detail', nft.id])).toEqual(nft)
  })

  it('loader converte not_found em notFound()', async () => {
    api.get.mockRejectedValue(new ApiError({ code: 'not_found', message: 'x' }, 404))
    const rejected = await options
      .loader({ context: { queryClient: createTestQueryClient() }, params: { nftId: 'nope' } })
      .catch((e: unknown) => e)
    expect(rejected).toEqual(notFound())
  })

  it('loader repassa os outros erros', async () => {
    const boom = new ApiError({ code: 'transient', message: 'x' }, 500)
    api.get.mockRejectedValue(boom)
    await expect(options.loader({ context: { queryClient: createTestQueryClient() }, params: { nftId: 'x' } })).rejects.toBe(boom)
    api.get.mockRejectedValue(new Error('rede'))
    await expect(options.loader({ context: { queryClient: createTestQueryClient() }, params: { nftId: 'x' } })).rejects.toThrow('rede')
  })

  it('o componente monta as seções com a edição padrão e troca a edição pela URL', async () => {
    const Component = options.component
    renderWithProviders(<Component />)
    expect(await screen.findByRole('heading', { name: 'Obra 7' })).toBeTruthy()
    for (const text of ['header:Obra 7', 'trilha', 'galeria', 'desc', 'mais', 'barra:1/10']) expect(screen.getByText(text)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'trocar edição' }))
    const arg = navigateSpy.mock.calls[0][0] as { search: (p: unknown) => unknown; replace: boolean; resetScroll: boolean }
    expect(arg.search({ edition: '1/10' })).toEqual({ edition: 'open' })
    expect(arg.replace).toBe(true)
    expect(arg.resetScroll).toBe(false)
  })

  it('a edição pedida na URL chega à barra de compra', async () => {
    search = { edition: 'open' }
    const Component = options.component
    renderWithProviders(<Component />)
    expect(await screen.findByText('barra:open')).toBeTruthy()
  })

  it('pendingComponent é o skeleton do Detalhe', () => {
    const Pending = options.pendingComponent
    renderWithProviders(<Pending />)
    expect(screen.getByRole('status').textContent).toBe('Carregando NFT…')
  })

  it('notFoundComponent explica e leva de volta ao Início', () => {
    const NotFound = options.notFoundComponent
    renderWithProviders(<NotFound />)
    expect(screen.getByText('NFT não encontrado', { selector: 'h2, h1, p, div' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voltar ao Início' }).getAttribute('href')).toBe('/')
  })

  it('errorComponent mostra o erro e "Tentar novamente" invalida o router, com o botão ocupado enquanto isso', async () => {
    let finish!: () => void
    invalidateSpy.mockReturnValueOnce(new Promise<void>((r) => (finish = r)))
    const Err = options.errorComponent
    renderWithProviders(<Err error={new Error('x')} reset={() => {}} info={undefined} />)
    expect(screen.getByText('Não foi possível carregar o NFT.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }))
    expect(invalidateSpy).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.getByRole('button').getAttribute('aria-disabled')).toBe('true'))
    finish()
    await waitFor(() => expect(screen.getByRole('button').getAttribute('aria-disabled')).toBeNull())
  })
})
