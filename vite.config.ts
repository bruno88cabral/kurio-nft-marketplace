import { fileURLToPath, URL } from 'node:url'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

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
    // Worktrees (.claude/) e E2E (Playwright, `pnpm e2e`) ficam fora do Vitest
    exclude: [...configDefaults.exclude, '.claude/**', 'e2e/**'],
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
        lines: 79,
        statements: 78,
        functions: 77,
        branches: 78,
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
        // COV-8: fluxo "Conta: perfil, senha, avatar e carteiras" travado em 100% (WalletForm e avatar: ver abaixo)
        'src/features/account/{ProfileForm,PasswordForm,AvatarField,WalletList,WalletDialogs,AccountLayout,AccountPanel}.tsx': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/features/account/useAccountForm.ts': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/components/kurio/{WalletCard,AccountSidebar,FormField}.tsx': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/routes/_authenticated/{profile,wallets}.tsx': { lines: 100, statements: 100, functions: 100, branches: 100 },
        // COV-10a: fluxo "Detalhe do NFT e favoritos" travado em 100%
        'src/features/nft-detail/*.{ts,tsx}': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/features/favorites/*.{ts,tsx}': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/features/cart/AddToCartButton.tsx': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/components/kurio/{FavoriteButton,EditionChips,QuantityStepper}.tsx': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/routes/nfts.$nftId.tsx': { lines: 100, statements: 100, functions: 100, branches: 100 },
        // WalletForm: `if (!isNetwork(network)) throw` é inalcançável (validateWallet já recusa rede vazia antes do request)
        'src/features/account/WalletForm.tsx': { lines: 100, statements: 94, functions: 100, branches: 90 },
        // avatar.ts: `Array.from(word)[0] ?? ''` em initials é inalcançável (o filter(Boolean) garante palavra não vazia)
        'src/features/account/avatar.ts': { lines: 100, statements: 100, functions: 100, branches: 90 },
        // HeroFeatured: `if (!current) return null` em FeaturedCarousel é inalcançável (o pai já trata lista vazia)
        'src/features/catalog/HeroFeatured.tsx': { lines: 100, statements: 95, functions: 100, branches: 94 },
      },
    },
  },
})
