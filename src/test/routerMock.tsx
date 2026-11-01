/**
 * Mock de `@tanstack/react-router` para testes de componente.
 *
 * Uso (o `vi.mock` é içado; a factory importa este módulo de forma assíncrona, e o `import` do teste e o da
 * factory resolvem para a MESMA instância, então `navigateSpy` e os controles abaixo são compartilhados):
 *
 *   vi.mock('@tanstack/react-router', async () => (await import('@/test/routerMock')).routerMock())
 *   import { navigateSpy, setSearch, setParams } from '@/test/routerMock'
 *
 * Controle por teste (valem até o `afterEach`, que volta tudo ao padrão `{}`):
 *   - `setSearch({ q: 'sol' })`    -> `useSearch()`
 *   - `setParams({ nftId: 'x' })`  -> `useParams()`
 *   - `setLocation({ pathname })`  -> `useLocation()`
 *   - `setRouterState({ ... })`    -> `useRouterState()` (aplica `select`, se houver)
 *   - ou use os `vi.fn` exportados (`useSearchSpy`, ...) com `mockReturnValue`.
 *   - `routerMock({ useSearch: () => ... })` troca um hook inteiro para o arquivo todo.
 */
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { afterEach, vi, type Mock } from 'vitest'

export const navigateSpy: Mock = vi.fn(() => Promise.resolve())

const DEFAULT_ROUTER_STATE = { location: { pathname: '/', search: {}, href: '/' } }

type Selectable = { select?: (state: unknown) => unknown } | undefined

function selected(value: unknown, opts: Selectable): unknown {
  return opts?.select ? opts.select(value) : value
}

export const useSearchSpy: Mock = vi.fn((opts?: Selectable): unknown => selected({}, opts))
export const useParamsSpy: Mock = vi.fn((opts?: Selectable): unknown => selected({}, opts))
export const useLocationSpy: Mock = vi.fn((opts?: Selectable): unknown => selected({}, opts))
export const useRouterStateSpy: Mock = vi.fn((opts?: Selectable): unknown => selected(DEFAULT_ROUTER_STATE, opts))

export const setSearch = (value: unknown): void => void useSearchSpy.mockImplementation((o?: Selectable) => selected(value, o))
export const setParams = (value: unknown): void => void useParamsSpy.mockImplementation((o?: Selectable) => selected(value, o))
export const setLocation = (value: unknown): void => void useLocationSpy.mockImplementation((o?: Selectable) => selected(value, o))
export const setRouterState = (value: unknown): void =>
  void useRouterStateSpy.mockImplementation((o?: Selectable) => selected(value, o))

function resetRouterMock(): void {
  navigateSpy.mockClear()
  useSearchSpy.mockReset().mockImplementation((o?: Selectable) => selected({}, o))
  useParamsSpy.mockReset().mockImplementation((o?: Selectable) => selected({}, o))
  useLocationSpy.mockReset().mockImplementation((o?: Selectable) => selected({}, o))
  useRouterStateSpy.mockReset().mockImplementation((o?: Selectable) => selected(DEFAULT_ROUTER_STATE, o))
}

afterEach(resetRouterMock)

type LinkProps = { children?: ReactNode; to?: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>

export interface RouterMock {
  Link: (props: LinkProps) => ReactNode
  Navigate: (props: { to: string }) => ReactNode
  useNavigate: () => Mock
  useSearch: (opts?: unknown) => unknown
  useParams: (opts?: unknown) => unknown
  useRouterState: (opts?: unknown) => unknown
  useLocation: (opts?: unknown) => unknown
}

export function routerMock(overrides: Partial<RouterMock> = {}): RouterMock {
  return {
    Link: ({ children, to, ...rest }: LinkProps) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
    Navigate: ({ to }: { to: string }) => <p data-testid="navigate">{to}</p>,
    useNavigate: () => navigateSpy,
    useSearch: (opts) => useSearchSpy(opts) as unknown,
    useParams: (opts) => useParamsSpy(opts) as unknown,
    useRouterState: (opts) => useRouterStateSpy(opts) as unknown,
    useLocation: (opts) => useLocationSpy(opts) as unknown,
    ...overrides,
  }
}
