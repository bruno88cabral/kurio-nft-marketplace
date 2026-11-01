import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { pageCount, pageItems } from '@/lib/catalogSearch'
import { cn } from '@/lib/utils'

export interface CatalogPaginationProps {
  page: number
  pageSize: number
  total: number
}

const pageButton = cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'dark:bg-transparent')

/**
 * O `Link` marca `aria-current="page"` sozinho quando está ativo, e por padrão a busca casa por
 * subconjunto: na página 2, o link da página 1 (sem `page`) também contaria como ativo. Com
 * `exact`, só a página atual leva o `aria-current`.
 */
const exactSearch = { exact: true } as const

/** `page` 1 fica fora da URL (padrão). */
const pageSearch = (page: number) => (prev: Record<string, unknown>) => ({ ...prev, page: page > 1 ? page : undefined })

/**
 * Paginação do catálogo (Figma `2:2`: "1 2 3 4 >", alinhada à direita). Cada página é um `<Link search>` real, então
 * voltar/avançar e abrir em nova aba funcionam; o hash leva de volta ao topo do catálogo.
 * Oculta quando há uma página só.
 */
export function CatalogPagination({ page, pageSize, total }: CatalogPaginationProps) {
  const count = pageCount(total, pageSize)
  if (count <= 1) return null

  return (
    <Pagination aria-label="Paginação do catálogo" className="justify-end">
      <PaginationContent className="flex-wrap justify-end gap-2">
        {page > 1 && (
          <PaginationItem>
            <Link
              to="/"
              search={pageSearch(page - 1)}
              hash="catalogo"
              activeOptions={exactSearch}
              aria-label="Página anterior"
              className={pageButton}
            >
              <ChevronLeft aria-hidden />
            </Link>
          </PaginationItem>
        )}
        {pageItems(page, count).map((item, i) =>
          item === 'ellipsis' ? (
            <PaginationItem key={`e${i}`}>
              <span aria-hidden className="text-muted-foreground flex size-9 items-center justify-center">
                …
              </span>
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <Link
                to="/"
                search={pageSearch(item)}
                hash="catalogo"
                activeOptions={exactSearch}
                aria-label={`Página ${item}`}
                aria-current={item === page ? 'page' : undefined}
                // Figma: a atual é laranja sólido (com peso maior, além da cor), as demais têm borda
                className={cn(
                  item === page ? buttonVariants({ size: 'icon' }) : pageButton,
                  'text-body tabular-nums',
                  item === page && 'font-bold',
                )}
              >
                {item}
              </Link>
            </PaginationItem>
          ),
        )}
        {page < count && (
          <PaginationItem>
            <Link
              to="/"
              search={pageSearch(page + 1)}
              hash="catalogo"
              activeOptions={exactSearch}
              aria-label="Próxima página"
              className={pageButton}
            >
              <ChevronRight aria-hidden />
            </Link>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  )
}
