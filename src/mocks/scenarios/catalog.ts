import type { ApiErrorBody } from '@/contracts'

export const SCENARIO_NAMES = [
  'default',
  'empty',
  'slow',
  'jitter',
  'offline',
  'server-error',
  'session-expired',
  'signup-conflict',
  'coupon-invalid',
  'coupon-expired',
  'price-changed',
  'sold-out',
  'order-timeout',
  'payment-declined',
  'favorite-fail',
  'wallet-rejected',
] as const

export type ScenarioName = (typeof SCENARIO_NAMES)[number]

/** `method` aceita `'*'`; `path` é um padrão MSW sem `API_URL` (ex.: `/favorites/:nftId`) ou `'*'`. */
export interface ScenarioFailure {
  method: string
  path: string
  respond: 'offline' | { status: number; body: ApiErrorBody }
  /** Quantas requisições casadas passam normalmente antes de a falha começar (padrão 0). */
  afterRequests?: number
}

export interface ScenarioRouteLatency {
  method: string
  path: string
  ms: number
}

export interface ScenarioRules {
  /** O seed não cria NFTs. */
  emptyCatalog?: boolean
  /** Duração do token emitido no login/cadastro (padrão: 24h). */
  sessionTtlMs?: number
  /** O cadastro sempre responde `conflict` (e-mail já usado). */
  signupConflict?: boolean
  /** Força o resultado de qualquer cupom, ignorando o código. */
  couponOutcome?: 'invalid' | 'expired'
  /** O preço muda entre a cotação e o pedido. */
  priceChangeAfterQuote?: boolean
  /** A edição esgota entre a cotação e o pedido. */
  soldOutAfterQuote?: boolean
  /** O pedido termina em `declined` em vez de `confirmed`. */
  paymentDeclined?: boolean
  /** Resultado de conectar uma carteira (padrão `accept`). */
  walletConnect?: 'accept' | 'reject'
  /** Tempo entre `pending` e o estado final do pedido. */
  orderSettleMs?: number
}

export type ScenarioLatency =
  | { kind: 'fixed'; ms: number }
  | { kind: 'random'; minMs: number; maxMs: number; seed: number }

export interface Scenario {
  name: ScenarioName
  latency: ScenarioLatency
  failures?: ScenarioFailure[]
  routeLatency?: ScenarioRouteLatency[]
  rules?: ScenarioRules
}

const transient = (message: string): ApiErrorBody => ({ code: 'transient', message })

const BASE: Omit<Scenario, 'name'> = {
  latency: { kind: 'fixed', ms: 150 },
  rules: { orderSettleMs: 2_500 },
}

function define(name: ScenarioName, overrides: Partial<Omit<Scenario, 'name'>> = {}): Scenario {
  return { ...BASE, name, ...overrides, rules: { ...BASE.rules, ...overrides.rules } }
}

// O apiClient tem timeout de 10s: `slow` e `jitter` ficam abaixo; só `order-timeout` passa.
export const SCENARIOS: Record<ScenarioName, Scenario> = {
  default: define('default'),
  empty: define('empty', { rules: { emptyCatalog: true } }),
  slow: define('slow', { latency: { kind: 'fixed', ms: 4_000 } }),
  jitter: define('jitter', {
    latency: { kind: 'random', minMs: 300, maxMs: 7_000, seed: 20_261_030 },
  }),
  offline: define('offline', {
    failures: [{ method: '*', path: '*', respond: 'offline' }],
  }),
  'server-error': define('server-error', {
    failures: [
      {
        method: '*',
        path: '*',
        respond: { status: 503, body: transient('Serviço indisponível. Tente novamente.') },
      },
    ],
  }),
  'session-expired': define('session-expired', { rules: { sessionTtlMs: 15_000 } }),
  'signup-conflict': define('signup-conflict', { rules: { signupConflict: true } }),
  'coupon-invalid': define('coupon-invalid', { rules: { couponOutcome: 'invalid' } }),
  'coupon-expired': define('coupon-expired', { rules: { couponOutcome: 'expired' } }),
  'price-changed': define('price-changed', { rules: { priceChangeAfterQuote: true } }),
  'sold-out': define('sold-out', { rules: { soldOutAfterQuote: true } }),
  'order-timeout': define('order-timeout', {
    routeLatency: [{ method: 'POST', path: '/orders', ms: 12_000 }],
  }),
  'payment-declined': define('payment-declined', { rules: { paymentDeclined: true } }),
  'favorite-fail': define('favorite-fail', {
    failures: ['PUT', 'DELETE'].map((method) => ({
      method,
      path: '/favorites/:nftId',
      respond: { status: 503, body: transient('Não foi possível atualizar os favoritos.') },
    })),
  }),
  'wallet-rejected': define('wallet-rejected', { rules: { walletConnect: 'reject' } }),
}
