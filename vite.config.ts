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
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
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
      thresholds: { lines: 57, statements: 58, functions: 50, branches: 55 },
    },
  },
})
