import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({ meta: [{ title: 'Kurio' }] }),
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <TooltipProvider>
      <HeadContent />
      <div className="bg-background text-foreground font-sans min-h-dvh">
        <Outlet />
      </div>
      <Toaster />
    </TooltipProvider>
  )
}

function NotFound() {
  return <h1>404 — Página não encontrada</h1>
}
