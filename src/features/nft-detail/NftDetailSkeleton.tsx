import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { DETAIL_ASIDE_CLASS, DETAIL_GRID_CLASS, DETAIL_PAGE_CLASS } from './layout'

function Bar({ className }: { className?: string }) {
  return <Skeleton className={cn('rounded-md motion-reduce:animate-none', className)} />
}

/**
 * `pendingComponent` do Detalhe: mesma grade, arte quadrada e alturas de linha da tela pronta
 * (breadcrumb/header de tela, coleção, título, criador/rede, preço, chips, stepper, ações).
 */
export function NftDetailSkeleton() {
  return (
    <div className={DETAIL_PAGE_CLASS} aria-busy="true">
      <span className="sr-only" role="status">
        Carregando NFT…
      </span>
      <div aria-hidden className="contents">
        {/* header de tela (mobile) / breadcrumb (md+) */}
        <div className="flex h-9 items-center gap-2 md:hidden">
          <Bar className="size-9" />
          <Bar className="h-5 w-40" />
        </div>
        <Bar className="hidden h-5 w-64 md:block" />
        <div className={DETAIL_GRID_CLASS}>
          <Skeleton className="aspect-square w-full rounded-xl motion-reduce:animate-none" />
          <div className={DETAIL_ASIDE_CLASS}>
            <div className="flex flex-col gap-3">
              <Bar className="h-4 w-28" />
              <Bar className="h-8 w-3/4 lg:h-12" />
              <Bar className="h-10 w-48" />
              <Bar className="h-8 w-32" />
            </div>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Bar className="h-4 w-14" />
                <div className="flex gap-2">
                  <Bar className="h-9 w-16" />
                  <Bar className="h-9 w-16" />
                </div>
              </div>
              <Bar className="h-9 w-40" />
              <div className="flex gap-2">
                <Bar className="hidden h-10 w-52 md:block" />
                <Bar className="h-10 w-28" />
                <Bar className="size-10" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
