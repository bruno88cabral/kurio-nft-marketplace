import { useNavigate } from '@tanstack/react-router'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useId, type FormEvent } from 'react'
import { activeFilterCount, withFilter } from '@/lib/catalogSearch'
import { cn } from '@/lib/utils'
import { CatalogFiltersSheet } from './CatalogToolbar'
import { useCatalogSearch } from './useCatalogSearch'

/**
 * Topo do Início no mobile (Figma `Mobile/Início.png`), só abaixo de `md`, onde o header do site
 * não aparece (`staticData.hideMobileChrome: 'header'`): a busca "Explorar coleções" (a mesma `?q=`
 * do header desktop, via `withFilter`, que volta à página 1 e mantém os filtros) e o botão laranja
 * que abre o drawer de filtros.
 */
export function CatalogMobileTopBar({ className }: { className?: string }) {
  const { search } = useCatalogSearch()
  const navigate = useNavigate()
  const inputId = useId()
  const count = activeFilterCount(search)

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const value = new FormData(e.currentTarget).get('q')
    const q = typeof value === 'string' ? value : ''
    void navigate({ to: '/', search: withFilter(search, { q }), hash: 'catalogo' })
  }

  return (
    <div className={cn('mx-auto flex w-full items-center gap-3 px-4 pt-6', className)}>
      <form
        role="search"
        aria-label="Buscar NFTs"
        onSubmit={onSubmit}
        className="bg-card focus-within:ring-ring flex h-14 min-w-0 flex-1 items-center rounded-2xl pr-4 focus-within:ring-3"
      >
        <button
          type="submit"
          aria-label="Buscar"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-12 shrink-0 items-center justify-center rounded-2xl outline-none focus-visible:ring-3 [&_svg]:size-6"
        >
          <Search aria-hidden />
        </button>
        <label htmlFor={inputId} className="sr-only">
          Explorar coleções
        </label>
        {/* `key`: quando o `q` muda fora daqui (chip "Remover busca", voltar), o campo acompanha */}
        <input
          key={search.q ?? ''}
          id={inputId}
          name="q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          defaultValue={search.q ?? ''}
          placeholder="Explorar coleções"
          className="text-foreground text-body-lg placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden"
        />
      </form>
      <CatalogFiltersSheet>
        <button
          type="button"
          aria-label={count > 0 ? `Filtros (${count} ${count === 1 ? 'ativo' : 'ativos'})` : 'Filtros'}
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring focus-visible:ring-offset-background relative flex size-14 shrink-0 items-center justify-center rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-offset-2 [&_svg]:size-6"
        >
          <SlidersHorizontal aria-hidden />
          {count > 0 && (
            <span
              aria-hidden
              className="bg-foreground text-background absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-[0.6875rem] font-bold"
            >
              {count}
            </span>
          )}
        </button>
      </CatalogFiltersSheet>
    </div>
  )
}
