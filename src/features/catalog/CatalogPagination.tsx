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

/** `page` 1 fica fora da URL (padrão). */
const pageSearch = (page: number) => (prev: Record<string, unknown>) => ({ ...prev, page: page > 1 ? page : undefined })

/**
 * Paginação do catálogo (Figma `2:2`: "1 2 3 4 >"). Cada página é um `<Link search>` real, então
 * voltar/avançar e abrir em nova aba funcionam; o hash leva de volta ao topo do catálogo.
 * Oculta quando há uma página só.
 */
export function CatalogPagination({ page, pageSize, total }: CatalogPaginationProps) {
  const count = pageCount(total, pageSize)
  if (count <= 1) return null

  return (
    <Pagination aria-label="Paginação do catálogo">
      <PaginationContent className="flex-wrap justify-center">
        {page > 1 && (
          <PaginationItem>
            <Link
              to="/"
              search={pageSearch(page - 1)}
              hash="catalogo"
              aria-label="Página anterior"
              className={buttonVariants({ variant: 'ghost', size: 'icon' })}
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
                aria-label={`Página ${item}`}
                aria-current={item === page ? 'page' : undefined}
                className={cn(
                  buttonVariants({ variant: item === page ? 'outline' : 'ghost', size: 'icon' }),
                  'tabular-nums',
                  item === page && 'border-primary text-text-accent',
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
              aria-label="Próxima página"
              className={buttonVariants({ variant: 'ghost', size: 'icon' })}
            >
              <ChevronRight aria-hidden />
            </Link>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  )
}
