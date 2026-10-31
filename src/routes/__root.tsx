import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { EmptyState } from '@/components/kurio'
import { MobileTabBar, TAB_BAR_PADDING_CLASS } from '@/components/layout/MobileTabBar'
import { MAIN_CONTENT_ID, SkipLink } from '@/components/layout/SkipLink'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
      <div className="bg-background text-foreground font-sans flex min-h-dvh flex-col">
        <SkipLink />
        <SiteHeader />
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className={cn('flex-1 outline-none', TAB_BAR_PADDING_CLASS)}>
          <Outlet />
        </main>
        <SiteFooter />
        <MobileTabBar />
      </div>
      <Toaster />
    </TooltipProvider>
  )
}

function NotFound() {
  return (
    <>
      <title>Página não encontrada · Kurio</title>
      <div className="mx-auto w-full max-w-xl px-4 py-16">
        <EmptyState
          title="Página não encontrada"
          description="O endereço que você tentou abrir não existe ou foi movido."
          action={
            <Link to="/" className={buttonVariants({ variant: 'default' })}>
              Voltar ao Início
            </Link>
          }
        />
      </div>
    </>
  )
}
