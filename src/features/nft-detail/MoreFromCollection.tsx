import { useQuery } from '@tanstack/react-query'
import { nftListQuery } from '@/api/nfts'
import type { Nft } from '@/contracts'
import { ErrorState } from '@/components/kurio'
import { NftGrid, NftGridSkeleton } from '@/features/catalog/NftGrid'
import { cn } from '@/lib/utils'

const MAX_ITEMS = 4
/** 4 colunas a partir de `md` (Figma `70342:2798`: uma linha de cards do carrossel). */
const GRID_CLASS = 'md:grid-cols-4 md:gap-4'

/**
 * "Mais desta coleção": até 4 outros NFTs da mesma coleção (pede 5 e tira o atual). Erro fica
 * só nesta seção, com retry; sem outros NFTs na coleção, a seção não aparece.
 */
export function MoreFromCollection({ nft, className }: { nft: Pick<Nft, 'id' | 'collection'>; className?: string }) {
  const list = useQuery(nftListQuery({ collections: [nft.collection], pageSize: MAX_ITEMS + 1 }))
  const items = list.data?.items.filter((item) => item.id !== nft.id).slice(0, MAX_ITEMS)

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
      <div aria-busy="true">
        <span className="sr-only">Carregando mais NFTs desta coleção…</span>
        <NftGridSkeleton count={MAX_ITEMS} size="carousel" className={GRID_CLASS} />
      </div>
    )
  } else {
    body = (
      <NftGrid
        items={items}
        stale={list.isPlaceholderData}
        size="carousel"
        label={`Mais NFTs de ${nft.collection}`}
        className={GRID_CLASS}
      />
    )
  }

  return (
    <section aria-labelledby="mais-da-colecao" className={cn('flex flex-col gap-4', className)}>
      <h2 id="mais-da-colecao" className="text-heading">
        Mais desta coleção
      </h2>
      {body}
    </section>
  )
}
