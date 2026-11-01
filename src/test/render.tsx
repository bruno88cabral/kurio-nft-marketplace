import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { installDomPolyfills, resetBrowserStorage } from './dom'

installDomPolyfills()

afterEach(() => {
  cleanup()
  resetBrowserStorage()
})

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
}

export function renderWithProviders(
  ui: ReactElement,
  opts: { queryClient?: QueryClient } = {},
): RenderResult & { queryClient: QueryClient } {
  const queryClient = opts.queryClient ?? createTestQueryClient()
  const result = render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  )
  return { ...result, queryClient }
}
