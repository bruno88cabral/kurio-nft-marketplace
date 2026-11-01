import { defineConfig, devices } from '@playwright/test'

const PORT = 5210
const baseURL = `http://localhost:${PORT}`

/**
 * E2E contra o build de produção servido pelo `vite preview` (mocks ligados pelo `.env.production`).
 * `desktop` roda tudo; `mobile` roda só o caminho principal (`@main`).
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    locale: 'pt-BR',
    // Sem o Chromium do Playwright instalado, rode com PW_CHANNEL=chrome para usar o Chrome do sistema
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      grep: /@main/,
    },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
