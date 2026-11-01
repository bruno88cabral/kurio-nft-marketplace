import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { EmptyState } from '@/components/kurio'
import { MobileTabBar, TAB_BAR_PADDING_CLASS } from '@/components/layout/MobileTabBar'
import { useHideMobileChrome } from '@/components/layout/routeChrome'
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
  // Rota com `staticData.hideMobileChrome`: abaixo de `md` ela desenha a própria moldura, sem o
  // header e a tab bar (`true`, Detalhe) ou só sem o header (`'header'`, Início)
  const hideMobileChrome = useHideMobileChrome()
  const showTabBar = hideMobileChrome !== true
  return (
    <TooltipProvider>
      <HeadContent />
      <div
        data-mobile-chrome={hideMobileChrome === true ? 'hidden' : hideMobileChrome || undefined}
        className={cn('bg-background text-foreground font-sans flex min-h-dvh flex-col', showTabBar && TAB_BAR_PADDING_CLASS)}
      >
        <SkipLink />
        <SiteHeader className={hideMobileChrome ? 'max-md:hidden' : undefined} />
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">
          <Outlet />
        </main>
        <SiteFooter />
        {showTabBar && <MobileTabBar />}
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
