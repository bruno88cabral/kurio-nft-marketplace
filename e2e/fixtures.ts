import { expect, test as base, type Page } from '@playwright/test'

/**
 * Fixtures dos E2E. Cada teste roda num contexto novo do navegador, então o `localStorage`
 * (banco do mock, sessão, carrinho de visitante) e o `sessionStorage` começam vazios: o estado
 * é isolado por teste sem precisar de reset.
 */

export type ScenarioName =
  | 'default'
  | 'empty'
  | 'slow'
  | 'jitter'
  | 'offline'
  | 'server-error'
  | 'session-expired'
  | 'signup-conflict'
  | 'coupon-invalid'
  | 'coupon-expired'
  | 'price-changed'
  | 'sold-out'
  | 'order-timeout'
  | 'payment-declined'
  | 'favorite-fail'
  | 'wallet-rejected'

/** Espelho mínimo de `KurioMock` (`src/mocks/devtools.ts`); o `e2e/` não importa código do app. */
export interface KurioMock {
  scenario: ScenarioName
  reset: (scenario?: ScenarioName) => void
  setScenario: (name: ScenarioName) => void
  emit: {
    nftUpdated: (nftId: string, patch: { price?: string }) => void
    orderUpdated: (orderId: string) => void
  }
  duplicateLast: () => void
}

declare global {
  interface Window {
    __kurioMock?: KurioMock
  }
}

export const USERS = {
  ana: { name: 'Ana Souza', email: 'ana@kurio.test', password: 'Kurio#2026' },
  bruno: { name: 'Bruno Lima', email: 'bruno@kurio.test', password: 'Kurio#2026' },
} as const

export type UserKey = keyof typeof USERS

/** Abre `path` com o cenário (padrão `default`) e espera o mock (`window.__kurioMock`) subir. */
export async function openApp(page: Page, path = '/', scenario: ScenarioName = 'default'): Promise<void> {
  const url = new URL(path, 'http://e2e.local')
  url.searchParams.set('scenario', scenario)
  await page.goto(`${url.pathname}${url.search}${url.hash}`)
  await page.waitForFunction(() => window.__kurioMock !== undefined)
  await expect.poll(() => mockScenario(page)).toBe(scenario)
}

/** Cenário ativo no mock da página. */
export function mockScenario(page: Page): Promise<ScenarioName | undefined> {
  return page.evaluate(() => window.__kurioMock?.scenario)
}

/** `__kurioMock.emit.nftUpdated(...)` tipado. */
export async function emitNftUpdated(page: Page, nftId: string, patch: { price?: string }): Promise<void> {
  await page.evaluate(([id, p]) => window.__kurioMock!.emit.nftUpdated(id, p), [nftId, patch] as const)
}

/**
 * Entra pela UI em `/login` (modal no desktop, página no mobile) e espera sair da tela de login.
 * `redirect` é para onde o app volta depois.
 */
export async function login(page: Page, user: UserKey = 'ana', redirect?: string): Promise<void> {
  const { email, password } = USERS[user]
  await page.goto(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByRole('textbox', { name: 'Senha', exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

/** Detalhe → adicionar ao carrinho → `/cart` (desktop "COMPRAR"; mobile "Comprar NFT"). */
export async function buyFromDetail(page: Page, nftPath = '/nfts/nft-002?edition=1%2F10'): Promise<void> {
  await page.goto(nftPath)
  await page.getByRole('button', { name: /^(comprar|comprar nft)$/i }).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(/\/cart$/)
}

/** Valores que passam na validação do "Perfil do colecionador" (README, "Preparar a compra", passo 5). */
export const COLLECTOR = {
  username: 'ana_kurio',
  profileName: 'Ana Colecionadora',
  referralCode: 'KURIO-2026',
  ensName: 'ana',
} as const

/**
 * "Preparar a compra" do README: entra como Ana, adiciona o `nft-002` (1/10), vai ao `/checkout`
 * pelo "Conectar e finalizar", preenche o formulário do colecionador e conecta o MetaMask.
 */
export async function prepareCheckout(page: Page, scenario: ScenarioName = 'default'): Promise<void> {
  await openApp(page, '/', scenario)
  await login(page, 'ana')
  await buyFromDetail(page)
  await page.getByRole('link', { name: 'Conectar e finalizar' }).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(/\/checkout$/)

  const main = page.getByRole('main')
  await main.getByLabel(/^Nome de usuário/).fill(COLLECTOR.username)
  await main.getByLabel(/^Nome do perfil/).fill(COLLECTOR.profileName)
  await main.getByLabel(/^Código de indicação/).fill(COLLECTOR.referralCode)
  await main.getByLabel(/^Nome ENS/).fill(COLLECTOR.ensName)

  await main.getByRole('radio', { name: /MetaMask/ }).click()
  await main.getByRole('button', { name: 'Conectar com MetaMask' }).click()
  await expect(main.getByText('Carteira principal conectada com MetaMask.')).toBeVisible()
}

/** "Confirmar compra" na página e, no diálogo "Revise seu pedido", "Confirmar compra". */
export async function confirmPurchase(page: Page): Promise<void> {
  await page.getByRole('main').getByRole('button', { name: 'Confirmar compra' }).click()
  const dialog = page.getByRole('dialog', { name: 'Revise seu pedido' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Confirmar compra' }).click()
}

/** Conta os `POST /api/orders` feitos pela página (para checar que não houve envio duplicado). */
export function countOrderPosts(page: Page): () => number {
  let count = 0
  page.on('request', (req) => {
    if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/orders') count += 1
  })
  return () => count
}

export const test = base
export { expect }
