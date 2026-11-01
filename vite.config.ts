/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // O plugin do router precisa vir antes do react()
    // Fora do Vitest: o plugin injeta HMR e code-splitting que o Vitest não executa (o `routeTree.gen.ts` é commitado)
    ...(process.env.VITEST ? [] : [tanstackRouter({ target: 'react', autoCodeSplitting: true })]),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Worktrees do Claude ficam em .claude/ e trariam cópias dos testes
    exclude: ['**/node_modules/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/routeTree.gen.ts',
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/app/start.tsx',
        'src/mocks/browser.ts',
        'src/mocks/socket.ts',
        'src/mocks/lifecycle.ts',
        'src/routes/dev.*.tsx',
      ],
      reporter: ['text-summary', 'json-summary', 'html'],
      thresholds: {
        lines: 68,
        statements: 68,
        functions: 65,
        branches: 68,
        // COV-7: fluxo "entrar, cadastrar, sair e guarda de rota" travado em 100%
        'src/features/account/{LoginForm,SignupForm,AuthDialog,PasswordInput}.tsx': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/features/account/{useAuthForm,useSignOut,authGuards,authRedirect,validation}.ts': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/components/layout/{AccountMenu,SessionLink}.tsx': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/routes/{login,signup,_authenticated}.tsx': { lines: 100, statements: 100, functions: 100, branches: 100 },
        // COV-9: fluxo "Catálogo (Início)" travado em 100% (HeroFeatured: ver abaixo)
        'src/features/catalog/{CatalogFilters,CatalogGrid,CatalogPagination,CatalogSection,CatalogToolbar,MintJournal,NftGrid,PromoCards}.tsx': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/features/catalog/useCatalogSearch.ts': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/components/layout/HeaderSearch.tsx': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/components/kurio/{NftCard,StateMessage,PriceTag}.tsx': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/routes/index.tsx': { lines: 100, statements: 100, functions: 100, branches: 100 },
        // HeroFeatured: `if (!current) return null` em FeaturedCarousel é inalcançável (o pai já trata lista vazia)
        'src/features/catalog/HeroFeatured.tsx': { lines: 100, statements: 95, functions: 100, branches: 94 },
      },
    },
  },
})
