/**
 * Configuração versionada do Lighthouse (§10 do enunciado, MYK-1116). Lida por `lighthouse/run.mjs`.
 *
 * - Build otimizado (`pnpm build` + `vite preview`) com os mocks ligados (`.env.production`) no
 *   cenário padrão `default`: nada é desligado para a auditoria (imagens, fontes, MSW e socket).
 * - Mobile = configuração padrão do Lighthouse (Moto G Power emulado, 4G lento, CPU 4x, throttling
 *   `simulate`); desktop = preset `desktop` do Lighthouse.
 * - Cada medição roda num Chrome novo, com perfil limpo (primeira visita).
 */
export const pages = [
  { name: 'inicio', label: 'Início', path: '/' },
  { name: 'detalhe', label: 'Detalhe', path: '/nfts/nft-001' },
]
export const profiles = ['mobile', 'desktop']
export const runs = 3
export const categories = ['performance', 'accessibility', 'best-practices', 'seo']
export const targets = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }
export const metrics = {
  LCP: 'largest-contentful-paint',
  CLS: 'cumulative-layout-shift',
  TBT: 'total-blocking-time',
}
/** Porta do `vite preview` da auditoria (nunca 5173 nem 4173). */
export const port = 5210
/** Chrome do sistema (o `chrome-launcher` o encontra); `CHROME_PATH` sobrescreve. */
export const chromeFlags = ['--headless=new', '--no-first-run', '--no-default-browser-check']
export const reportsDir = 'lighthouse/reports'
