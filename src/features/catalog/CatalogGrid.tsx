import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'
import { nftListQuery } from '@/api/nfts'
import { EmptyState, ErrorState } from '@/components/kurio'
import { Button, buttonVariants } from '@/components/ui/button'
import { CATALOG_PAGE_SIZE, CLEAR_SIDEBAR_FILTERS, pageCount, toListParams } from '@/lib/catalogSearch'
import { CatalogPagination } from './CatalogPagination'
import { NftGrid, NftGridSkeleton } from './NftGrid'
import { useCatalogSearch } from './useCatalogSearch'

function resultsLabel(total: number): string {
  return total === 1 ? '1 NFT encontrado' : `${total} NFTs encontrados`
}

/**
 * Resultado do catálogo (`GET /nfts` com os parâmetros da URL). Skeleton só na primeira carga;
 * nas trocas seguintes o dado anterior fica na tela (keepPreviousData) com opacidade reduzida.
 * Erro e vazio aparecem só aqui: o resto da página (hero, filtros) continua de pé.
 */
export function CatalogGrid() {
  const { search, update } = useCatalogSearch()
  const list = useQuery(nftListQuery(toListParams(search)))
  const data = list.data
  const announce = data && !list.isPlaceholderData ? resultsLabel(data.total) : ''

  let body
  if (list.isError) {
    body = (
      <ErrorState
        title="Não foi possível carregar os NFTs."
        description="Verifique sua conexão e tente de novo."
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    )
  } else if (!data) {
    body = (
      <div aria-busy="true">
        <span className="sr-only">Carregando NFTs…</span>
        <NftGridSkeleton count={CATALOG_PAGE_SIZE} />
      </div>
    )
  } else if (data.total === 0) {
    body = (
      <EmptyState
        icon={<SearchX />}
        title="Nenhum NFT encontrado"
        description="Tente outra busca ou remova alguns filtros."
        action={
          <Button type="button" variant="outline" onClick={() => update({ ...CLEAR_SIDEBAR_FILTERS, q: undefined })}>
            Limpar filtros
          </Button>
        }
      />
    )
  } else if (data.items.length === 0) {
    const last = pageCount(data.total, data.pageSize)
    body = (
      <EmptyState
        title="Página não existe"
        description={`O catálogo tem ${last} ${last === 1 ? 'página' : 'páginas'} com esses filtros.`}
        action={
          <Link
            to="/"
            search={(prev) => ({ ...prev, page: last > 1 ? last : undefined })}
            hash="catalogo"
            className={buttonVariants({ variant: 'outline' })}
          >
            Ir para a última página
          </Link>
        }
      />
    )
  } else {
    body = (
      <div className="flex flex-col gap-8">
        <NftGrid items={data.items} stale={list.isPlaceholderData} label="Resultados do catálogo" />
        <CatalogPagination page={data.page} pageSize={data.pageSize} total={data.total} />
      </div>
    )
  }

  return (
    <div data-slot="catalog-grid" className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        {announce}
      </p>
      {body}
    </div>
  )
}
