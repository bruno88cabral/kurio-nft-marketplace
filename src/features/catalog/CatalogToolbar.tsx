import { SlidersHorizontal, X } from 'lucide-react'
import { useId } from 'react'
import type { NftListSort, NftListTab } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { TabsList, TabsTrigger } from '@/components/ui/tabs'
import { activeFilterCount } from '@/lib/catalogSearch'
import { CatalogFilters } from './CatalogFilters'
import { useCatalogSearch } from './useCatalogSearch'

const CATALOG_TABS: ReadonlyArray<{ value: NftListTab; label: string }> = [
  { value: 'all', label: 'Todos os NFTs' },
  { value: 'new', label: 'Novos lançamentos' },
  { value: 'trending', label: 'Em alta' },
]

const SORTS: ReadonlyArray<{ value: NftListSort; label: string }> = [
  { value: 'newest', label: 'Listados recentemente' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
]

/**
 * Abas, ordenação, chip da busca do header e (abaixo de `lg`) o botão "Filtros (n)" que abre o
 * drawer. Precisa estar dentro do `<Tabs>` da seção do catálogo.
 */
export function CatalogToolbar() {
  const { search, update } = useCatalogSearch()
  const sortId = useId()
  const count = activeFilterCount(search)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <TabsList variant="line" aria-label="Recorte do catálogo" className="max-w-full justify-start overflow-x-auto">
          {CATALOG_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="text-caption sm:text-body flex-none px-2 sm:px-3">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="flex items-center justify-between gap-2 lg:justify-end">
          <Sheet>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" className="lg:hidden">
                <SlidersHorizontal aria-hidden />
                Filtros{count > 0 ? ` (${count})` : ''}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" aria-describedby={undefined} className="w-[85%] max-w-sm gap-0 overflow-y-auto">
              <SheetHeader className="border-border border-b">
                <SheetTitle className="text-body-lg">Filtros</SheetTitle>
              </SheetHeader>
              <CatalogFilters className="p-4" />
              <SheetFooter className="border-border bg-popover sticky bottom-0 border-t">
                <SheetClose asChild>
                  <Button type="button">Ver resultados</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <div className="flex min-w-0 items-center gap-2">
            <Label htmlFor={sortId} className="text-muted-foreground text-body sr-only shrink-0 font-normal sm:not-sr-only">
              Ordenar por:
            </Label>
            <Select
              value={search.sort ?? 'newest'}
              onValueChange={(value) => update({ sort: value as NftListSort })}
            >
              <SelectTrigger id={sortId} className="min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      {search.q && (
        <div className="flex">
          <span className="bg-muted border-border-soft text-body inline-flex max-w-full items-center gap-1 rounded-full border py-1 pr-1 pl-3">
            <span className="truncate">Busca: {search.q}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              aria-label={`Remover busca "${search.q}"`}
              onClick={() => update({ q: undefined })}
            >
              <X aria-hidden />
            </Button>
          </span>
        </div>
      )}
    </div>
  )
}
