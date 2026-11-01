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
        lines: 62,
        statements: 63,
        functions: 56,
        branches: 61,
        // COV-7: fluxo "entrar, cadastrar, sair e guarda de rota" travado em 100%
        'src/features/account/{LoginForm,SignupForm,AuthDialog,PasswordInput}.tsx': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/features/account/{useAuthForm,useSignOut,authGuards,authRedirect,validation}.ts': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/components/layout/{AccountMenu,SessionLink}.tsx': { lines: 100, statements: 100, functions: 100, branches: 100 },
        'src/routes/{login,signup,_authenticated}.tsx': { lines: 100, statements: 100, functions: 100, branches: 100 },
      },
    },
  },
})
