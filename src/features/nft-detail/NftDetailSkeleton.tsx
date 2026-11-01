import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  DETAIL_GRID_CLASS,
  DETAIL_HERO_CLASS,
  DETAIL_PAGE_CLASS,
  DETAIL_PANEL_CLASS,
  DETAIL_TOP_CLASS,
  GALLERY_ART_CLASS,
  GALLERY_CLASS,
  GALLERY_MAIN_CLASS,
} from './layout'

function Bar({ className }: { className?: string }) {
  return <Skeleton className={cn('rounded-md', className)} />
}

/**
 * `pendingComponent` do Detalhe: as mesmas caixas de `layout.ts` (topo do mobile com voltar e
 * favoritar, galeria com a coluna de miniaturas no desktop, painel) e as alturas de linha da tela
 * pronta (nome, preço, "Sobre este NFT:", edição, quantidade e ações, coleção e criador,
 * compartilhar). As seções abaixo (detalhes, "Mais desta coleção") entram depois.
 */
export function NftDetailSkeleton() {
  return (
    <div className={DETAIL_PAGE_CLASS} aria-busy="true">
      <span className="sr-only" role="status">
        Carregando NFT…
      </span>
      <div aria-hidden className={DETAIL_TOP_CLASS}>
        <Bar className="hidden h-11 w-40 md:block lg:h-[1.3125rem]" />
        <div className={DETAIL_GRID_CLASS}>
          <div className={DETAIL_HERO_CLASS}>
            <div className="flex items-center justify-between md:hidden">
              <Bar className="size-11 rounded-full" />
              <Bar className="size-11 rounded-full" />
            </div>
            <div className={GALLERY_CLASS}>
              <div className={GALLERY_MAIN_CLASS}>
                <Skeleton className={cn(GALLERY_ART_CLASS, 'w-full')} />
              </div>
              <div className="hidden md:col-start-1 md:row-start-1 md:flex md:flex-col md:p-0.5">
                <Skeleton className="aspect-square w-full rounded-lg" />
              </div>
            </div>
          </div>
          <div className={DETAIL_PANEL_CLASS}>
            {/* nome e preço (o preço só no desktop) */}
            <div className="flex flex-col gap-1 md:border-border-soft md:border-b md:pb-3">
              <Bar className="h-[1.95rem] w-3/4 lg:h-[2.275rem]" />
              <Bar className="hidden h-[1.95rem] w-32 md:block" />
            </div>
            {/* "Sobre este NFT:" e a descrição */}
            <div className="flex flex-col gap-2">
              <Bar className="hidden h-[1.3125rem] w-36 md:block" />
              {/* 3 linhas abaixo de `lg`, 2 a partir dele (o texto das fixtures) */}
              <Bar className="h-[4.265625rem] w-full lg:h-[2.84375rem]" />
            </div>
            {/* edição, disponíveis, quantidade e ações */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Bar className="h-[1.3125rem] w-20" />
                <div className="flex gap-2">
                  <Bar className="h-11 w-16 rounded-full lg:h-8" />
                  <Bar className="h-11 w-16 rounded-full lg:h-8" />
                </div>
                <Bar className="h-[1.125rem] w-36" />
              </div>
              <div className="hidden flex-col items-start gap-3 md:flex lg:flex-row lg:items-center lg:gap-4">
                <Bar className="h-12 w-[8.5rem]" />
                <div className="flex gap-3 lg:ml-auto">
                  <Bar className="h-11 w-32" />
                  <Bar className="h-11 w-32" />
                </div>
              </div>
            </div>
            {/* coleção e criador */}
            <div className="flex flex-col gap-2">
              <Bar className="h-[1.3125rem] w-48" />
              <Bar className="h-[1.3125rem] w-40" />
            </div>
            <Bar className="hidden h-11 w-72 md:block lg:h-9" />
          </div>
        </div>
      </div>
    </div>
  )
}
