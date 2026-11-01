/**
 * Mock de `@tanstack/react-router` para testes de COMPONENTE.
 *
 * Uso (o `vi.mock` é içado; a factory importa este módulo de forma assíncrona, e o `import` do teste e o da
 * factory resolvem para a MESMA instância, então `navigateSpy` e os controles abaixo são compartilhados):
 *
 *   import { navigateSpy, setSearch, setParams } from '@/test/routerMock'   // no topo: avalia o módulo na coleta
 *   vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
 *
 * O `afterEach` de reset é registrado no nível do módulo, então o módulo precisa ser avaliado na coleta do
 * arquivo (import estático no topo, como acima, ou a factory rodando via import estático do componente mockado).
 * Nunca o importe dinamicamente de dentro de um `it`.
 *
 * Controle por teste (valem até o `afterEach`, que volta tudo ao padrão `{}`):
 *   - `setSearch({ q: 'sol' })`       -> `useSearch()` (e `getRouteApi(id).useSearch()`)
 *   - `setParams({ nftId: 'x' })`     -> `useParams()`
 *   - `setLocation({ pathname })`     -> `useLocation()` (e o `isActive` do `Link`)
 *   - `setRouterState({ ... })`       -> `useRouterState()` e `useRouter().state` (aplica `select`)
 *   - `setLoaderData(x)`              -> `getRouteApi(id).useLoaderData()`
 *   - `setCanGoBack(true)`            -> `useCanGoBack()`
 *   - ou os `vi.fn` exportados (`useSearchSpy`, ...) com `mockReturnValue`.
 *   - `routerMock({ useSearch: () => ... })` troca um hook inteiro para o arquivo todo.
 * Spies de ação: `navigateSpy`, `invalidateSpy`, `historyBackSpy`, `historyGoSpy`.
 *
 * ROTAS (`createFileRoute`, `redirect`, `notFound`) NÃO são tratadas aqui: para testar `beforeLoad`, `loader`,
 * `validateSearch` e `head`, importe o módulo real da rota SEM mockar o router e chame
 * `Route.options.beforeLoad(...)` etc. direto. O componente da rota é coberto pela feature.
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { afterEach, vi, type Mock } from 'vitest'

export const navigateSpy: Mock = vi.fn(() => Promise.resolve())
export const invalidateSpy: Mock = vi.fn(() => Promise.resolve())
export const historyBackSpy: Mock = vi.fn()
export const historyGoSpy: Mock = vi.fn()

const DEFAULT_ROUTER_STATE = { location: { pathname: '/', search: {}, href: '/' } }

type Selectable = { select?: (state: unknown) => unknown } | undefined

function selected(value: unknown, opts: Selectable): unknown {
  return opts?.select ? opts.select(value) : value
}

let currentSearch: unknown = {}
let currentRouterState: unknown = DEFAULT_ROUTER_STATE


export const useSearchSpy: Mock = vi.fn((opts?: Selectable): unknown => selected({}, opts))
export const useParamsSpy: Mock = vi.fn((opts?: Selectable): unknown => selected({}, opts))
export const useLocationSpy: Mock = vi.fn((opts?: Selectable): unknown => selected({}, opts))
export const useRouterStateSpy: Mock = vi.fn((opts?: Selectable): unknown => selected(DEFAULT_ROUTER_STATE, opts))
export const useLoaderDataSpy: Mock = vi.fn((opts?: Selectable): unknown => selected(undefined, opts))
export const useCanGoBackSpy: Mock = vi.fn((): boolean => false)

export function setSearch(value: unknown): void {
  currentSearch = value
  useSearchSpy.mockImplementation((o?: Selectable) => selected(value, o))
}
export const setParams = (value: unknown): void => void useParamsSpy.mockImplementation((o?: Selectable) => selected(value, o))
export const setLocation = (value: unknown): void => void useLocationSpy.mockImplementation((o?: Selectable) => selected(value, o))
export function setRouterState(value: unknown): void {
  currentRouterState = value
  useRouterStateSpy.mockImplementation((o?: Selectable) => selected(value, o))
}
export function setLoaderData(value: unknown): void {
  useLoaderDataSpy.mockImplementation((o?: Selectable) => selected(value, o))
}
export const setCanGoBack = (value: boolean): void => void useCanGoBackSpy.mockReturnValue(value)

function resetRouterMock(): void {
  currentSearch = {}
  currentRouterState = DEFAULT_ROUTER_STATE
  for (const spy of [navigateSpy, invalidateSpy, historyBackSpy, historyGoSpy]) spy.mockClear()
  useSearchSpy.mockReset().mockImplementation((o?: Selectable) => selected({}, o))
  useParamsSpy.mockReset().mockImplementation((o?: Selectable) => selected({}, o))
  useLocationSpy.mockReset().mockImplementation((o?: Selectable) => selected({}, o))
  useRouterStateSpy.mockReset().mockImplementation((o?: Selectable) => selected(DEFAULT_ROUTER_STATE, o))
  useLoaderDataSpy.mockReset().mockImplementation((o?: Selectable) => selected(undefined, o))
  useCanGoBackSpy.mockReset().mockReturnValue(false)
}

afterEach(resetRouterMock)

type Dest = {
  to?: string
  params?: Record<string, unknown>
  search?: Record<string, unknown> | ((prev: unknown) => Record<string, unknown>) | true
  hash?: string
}

/** Monta o destino como o router real faria: `$param` substituído, query string e `#hash`. */
export function hrefOf({ to = '', params, search, hash }: Dest): string {
  let path = to
  for (const [k, v] of Object.entries(params ?? {})) path = path.replace(`$${k}`, encodeURIComponent(String(v)))
  const resolved = typeof search === 'function' ? search(currentSearch) : search === true ? currentSearch : search
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries((resolved ?? {}) as Record<string, unknown>)) {
    if (v !== undefined && v !== null) qs.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
  }
  const query = qs.toString()
  return `${path}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`
}

type LinkProps = Dest & {
  children?: ReactNode | ((state: { isActive: boolean }) => ReactNode)
  // Props do router que não podem chegar ao DOM
  replace?: boolean
  activeOptions?: unknown
  activeProps?: unknown
  inactiveProps?: unknown
  preload?: unknown
  resetScroll?: boolean
  from?: string
  mask?: unknown
  state?: unknown
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'>

type NavigateProps = Dest & { replace?: boolean }

export interface RouterMock {
  Link: (props: LinkProps) => ReactNode
  Navigate: (props: NavigateProps) => ReactNode
  Outlet: () => ReactNode
  HeadContent: () => ReactNode
  useNavigate: () => Mock
  useSearch: (opts?: unknown) => unknown
  useParams: (opts?: unknown) => unknown
  useRouterState: (opts?: unknown) => unknown
  useLocation: (opts?: unknown) => unknown
  useMatch: (opts?: unknown) => unknown
  useMatches: (opts?: unknown) => unknown
  useRouter: () => {
    navigate: Mock
    invalidate: Mock
    history: { back: Mock; go: Mock }
    state: unknown
  }
  useCanGoBack: () => boolean
  getRouteApi: (id?: string) => {
    useSearch: (opts?: unknown) => unknown
    useParams: (opts?: unknown) => unknown
    useNavigate: () => Mock
    useLoaderData: (opts?: unknown) => unknown
  }
}

export function routerMock(overrides: Partial<RouterMock> = {}): RouterMock {
  return {
    Link: ({
      children,
      to,
      params,
      search,
      hash,
      /* eslint-disable @typescript-eslint/no-unused-vars -- props do router, só descartadas */
      replace,
      activeOptions,
      activeProps,
      inactiveProps,
      preload,
      resetScroll,
      from,
      mask,
      state,
      /* eslint-enable @typescript-eslint/no-unused-vars */
      ...rest
    }: LinkProps) => {
      const pathname = (useLocationSpy() as { pathname?: string } | undefined)?.pathname
      return (
        <a href={hrefOf({ to, params, search, hash })} {...rest}>
          {typeof children === 'function' ? children({ isActive: to !== undefined && to === pathname }) : children}
        </a>
      )
    },
    Navigate: (props: NavigateProps) => <p data-testid="navigate">{hrefOf(props)}</p>,
    Outlet: () => <div data-testid="outlet" />,
    HeadContent: () => null,
    useNavigate: () => navigateSpy,
    useSearch: (opts) => useSearchSpy(opts) as unknown,
    useParams: (opts) => useParamsSpy(opts) as unknown,
    useRouterState: (opts) => useRouterStateSpy(opts) as unknown,
    useLocation: (opts) => useLocationSpy(opts) as unknown,
    useMatch: () => ({}),
    useMatches: () => [],
    useRouter: () => ({
      navigate: navigateSpy,
      invalidate: invalidateSpy,
      history: { back: historyBackSpy, go: historyGoSpy },
      state: currentRouterState,
    }),
    useCanGoBack: () => useCanGoBackSpy() as boolean,
    getRouteApi: () => ({
      useSearch: (opts) => useSearchSpy(opts) as unknown,
      useParams: (opts) => useParamsSpy(opts) as unknown,
      useNavigate: () => navigateSpy,
      useLoaderData: (opts) => useLoaderDataSpy(opts) as unknown,
    }),
    ...overrides,
  }
}
