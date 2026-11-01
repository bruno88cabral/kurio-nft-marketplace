import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { nftListQuery } from '@/api/nfts'
import type { Nft } from '@/contracts'
import { ErrorState, NftCard, NftCardSkeleton } from '@/components/kurio'
import { cn } from '@/lib/utils'

const MAX_ITEMS = 5
/**
 * Trilho do carrossel: 2 cards visíveis no celular, 3 a partir de `md` e 5 a partir de `lg` (Figma).
 * O `p-1.5` dos itens (com o `-m-1.5` do trilho) deixa espaço para o anel de foco do card, que o
 * `overflow` do trilho cortaria.
 */
const TRACK_CLASS = 'flex gap-1.5 md:gap-2.5 lg:gap-4.5'
const ITEM_CLASS =
  'min-w-0 shrink-0 snap-start p-1.5 basis-[calc((100%-0.375rem)/2)] md:basis-[calc((100%-1.25rem)/3)] lg:basis-[calc((100%-4.5rem)/5)]'

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Páginas do trilho e a atual, medidas no DOM (o número de cards visíveis muda com a largura).
 * Com tudo cabendo na tela, uma página só: os dots não aparecem.
 */
function useTrackPages(count: number) {
  const ref = useRef<HTMLUListElement>(null)
  const [state, setState] = useState({ pages: 1, current: 0 })

  const measure = useCallback(() => {
    const el = ref.current
    if (!el || el.clientWidth === 0) return
    const pages = Math.max(1, Math.round(el.scrollWidth / el.clientWidth))
    const maxScroll = el.scrollWidth - el.clientWidth
    const current = maxScroll <= 0 ? 0 : Math.round((el.scrollLeft / maxScroll) * (pages - 1))
    setState((prev) => (prev.pages === pages && prev.current === current ? prev : { pages, current }))
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : undefined
    observer?.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      observer?.disconnect()
    }
  }, [measure, count])

  const goTo = (page: number) => {
    const el = ref.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    const left = state.pages <= 1 ? 0 : (maxScroll * page) / (state.pages - 1)
    el.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  return { ref, ...state, goTo }
}

/**
 * "Mais desta coleção" (Figma): título laranja pequeno com linha embaixo e um carrossel de até 5
 * outros NFTs da mesma coleção (pede 6 e tira o atual), com rolagem horizontal por toque e snap.
 * Os dots aparecem quando há mais cards do que cabem (no celular e no tablet); cada um rola até a
 * sua página. Tab pelos cards também rola o trilho. Erro fica só nesta seção, com retry; sem
 * outros NFTs na coleção, a seção não aparece.
 */
export function MoreFromCollection({ nft, className }: { nft: Pick<Nft, 'id' | 'collection'>; className?: string }) {
  const list = useQuery({
    ...nftListQuery({ collections: [nft.collection], pageSize: MAX_ITEMS + 1 }),
    // Sem keepPreviousData: ao trocar de NFT/coleção, a coleção anterior não pode aparecer com o rótulo da nova
    placeholderData: undefined,
  })
  const items = list.data?.items.filter((item) => item.id !== nft.id).slice(0, MAX_ITEMS)
  const { ref: trackRef, pages, current, goTo } = useTrackPages(items?.length ?? 0)

  if (items && items.length === 0) return null

  let body
  if (list.isError) {
    body = (
      <ErrorState
        title="Não foi possível carregar mais NFTs desta coleção."
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    )
  } else if (!items) {
    body = (
      <div aria-busy="true" className="-m-1.5 overflow-hidden">
        <span className="sr-only">Carregando mais NFTs desta coleção…</span>
        <div aria-hidden className={TRACK_CLASS}>
          {Array.from({ length: MAX_ITEMS }, (_, i) => (
            <div key={i} className={ITEM_CLASS}>
              <NftCardSkeleton size="carousel" />
            </div>
          ))}
        </div>
      </div>
    )
  } else {
    body = (
      <div className="flex flex-col gap-6">
        <ul
          ref={trackRef}
          aria-label={`Mais NFTs de ${nft.collection}`}
          className={cn(TRACK_CLASS, '-m-1.5 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden')}
        >
          {items.map((item) => (
            <li key={item.id} className={ITEM_CLASS}>
              <NftCard nft={item} previousPrice={item.previousPrice} size="carousel" className="h-full" />
            </li>
          ))}
        </ul>
        {pages > 1 && (
          <div role="group" aria-label="Páginas do carrossel" className="flex justify-center gap-1">
            {Array.from({ length: pages }, (_, page) => (
              <button
                key={page}
                type="button"
                aria-label={`Página ${page + 1} de ${pages}`}
                aria-current={page === current || undefined}
                onClick={() => goTo(page)}
                className="group/dot focus-visible:ring-ring flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-3"
              >
                <span
                  aria-hidden
                  className={cn(
                    'border-foreground size-3 rounded-full border transition-colors',
                    page === current && 'bg-foreground',
                  )}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <section aria-labelledby="mais-da-colecao" className={cn('flex flex-col gap-6', className)}>
      <h2 id="mais-da-colecao" className="border-border-soft text-text-accent text-body-lg border-b pb-2 font-bold">
        Mais desta coleção
      </h2>
      {body}
    </section>
  )
}
