import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { nftFacetsQuery } from '@/api/nfts'
import type { NftFacets } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { activeFilterCount, CLEAR_SIDEBAR_FILTERS, type CatalogSearch } from '@/lib/catalogSearch'
import { formatEth } from '@/lib/eth'
import { priceRangePatch, sliderBounds, sliderValue, stepsToEth, type SliderRange } from '@/lib/priceRange'
import { cn } from '@/lib/utils'
import { networkLabel } from '@/lib/wallets'
import { useCatalogSearch } from './useCatalogSearch'

const ALL_NETWORKS = 'all'

const groupTitle = 'text-caption text-muted-foreground font-bold uppercase tracking-wide'

export interface CatalogFiltersProps {
  className?: string
}

/**
 * Filtros da sidebar (Figma `2:2`): coleções e rede aplicam na hora; a faixa de preço só no
 * "Aplicar". As contagens vêm de `GET /nfts/facets` (catálogo inteiro). O mesmo componente é
 * usado na sidebar (lg+) e dentro do drawer (abaixo de lg).
 */
export function CatalogFilters({ className }: CatalogFiltersProps) {
  const { search, update } = useCatalogSearch()
  const facets = useQuery(nftFacetsQuery())
  const count = activeFilterCount(search)

  return (
    <div data-slot="catalog-filters" className={cn('flex flex-col gap-6', className)}>
      {facets.isPending ? (
        <FiltersSkeleton />
      ) : facets.isError ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-muted-foreground text-caption">Não foi possível carregar os filtros.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => !facets.isFetching && void facets.refetch()}
            aria-disabled={facets.isFetching || undefined}
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <CollectionFilter facets={facets.data} search={search} onChange={update} />
          <PriceFilter
            // Remonta (e descarta o rascunho) quando a faixa da URL muda, ex.: voltar/avançar ou "Limpar"
            key={`${search.priceMin ?? ''}-${search.priceMax ?? ''}`}
            facets={facets.data}
            search={search}
            onApply={update}
          />
          <NetworkFilter facets={facets.data} search={search} onChange={update} />
        </>
      )}
      {count > 0 && (
        <Button type="button" variant="ghost" className="self-start" onClick={() => update(CLEAR_SIDEBAR_FILTERS)}>
          Limpar filtros
        </Button>
      )}
    </div>
  )
}

interface FilterProps {
  facets: NftFacets
  search: CatalogSearch
  onChange: ReturnType<typeof useCatalogSearch>['update']
}

function CollectionFilter({ facets, search, onChange }: FilterProps) {
  const id = useId()
  const selected = new Set(search.collections ?? [])
  const toggle = (name: string, checked: boolean) => {
    const next = new Set(selected)
    if (checked) next.add(name)
    else next.delete(name)
    onChange({ collections: [...next] })
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={cn(groupTitle, 'mb-3')}>Coleções</legend>
      {facets.collections.length === 0 && <p className="text-muted-foreground text-caption">Nenhuma coleção.</p>}
      {facets.collections.map(({ name, count }, i) => (
        <div key={name} className="flex items-center gap-2">
          <Checkbox
            id={`${id}-${i}`}
            checked={selected.has(name)}
            onCheckedChange={(checked) => toggle(name, checked === true)}
          />
          <Label htmlFor={`${id}-${i}`} className="text-body flex flex-1 justify-between gap-2 font-normal">
            <span className="truncate">{name}</span>
            <span className="text-muted-foreground tabular-nums">({count})</span>
          </Label>
        </div>
      ))}
    </fieldset>
  )
}

function PriceFilter({ facets, search, onApply }: Omit<FilterProps, 'onChange'> & { onApply: FilterProps['onChange'] }) {
  const labelId = useId()
  const bounds = sliderBounds(facets.price)
  const [draft, setDraft] = useState<SliderRange>(() => sliderValue(search, facets.price))
  const disabled = bounds[0] >= bounds[1]
  const text = `Preço: ${formatEth(stepsToEth(draft[0]))} – ${formatEth(stepsToEth(draft[1]))} ETH`

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-3">
      <p id={labelId} className={groupTitle}>
        Faixa de preço
      </p>
      <Slider
        min={bounds[0]}
        max={bounds[1]}
        step={1}
        minStepsBetweenThumbs={0}
        value={draft}
        disabled={disabled}
        onValueChange={(v) => setDraft([v[0] ?? bounds[0], v[1] ?? bounds[1]])}
        getThumbProps={(i) => ({
          'aria-label': i === 0 ? 'Preço mínimo' : 'Preço máximo',
          'aria-valuetext': `${formatEth(stepsToEth(draft[i] ?? 0))} ETH`,
        })}
        className="py-2"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-body tabular-nums">{text}</p>
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => onApply(priceRangePatch(draft, facets.price))}
        >
          Aplicar
        </Button>
      </div>
    </div>
  )
}

function NetworkFilter({ facets, search, onChange }: FilterProps) {
  const id = useId()
  const total = facets.networks.reduce((sum, n) => sum + n.count, 0)
  const options = [
    { value: ALL_NETWORKS, label: 'Todas', count: total },
    ...facets.networks.map((n) => ({ value: n.network, label: networkLabel(n.network), count: n.count })),
  ]

  return (
    <fieldset className="flex flex-col">
      <legend className={cn(groupTitle, 'mb-3')}>Rede</legend>
      <RadioGroup
        value={search.network ?? ALL_NETWORKS}
        onValueChange={(value) =>
          onChange({ network: value === ALL_NETWORKS ? undefined : (value as NonNullable<CatalogSearch['network']>) })
        }
      >
        {options.map((o, i) => (
          <div key={o.value} className="flex items-center gap-2">
            <RadioGroupItem id={`${id}-${i}`} value={o.value} />
            <Label htmlFor={`${id}-${i}`} className="text-body flex flex-1 justify-between gap-2 font-normal">
              <span>{o.label}</span>
              <span className="text-muted-foreground tabular-nums">({o.count})</span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  )
}

function FiltersSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      {[5, 2, 5].map((rows, g) => (
        <div key={g} className="flex flex-col gap-3">
          <Skeleton className="h-3 w-24 motion-reduce:animate-none" />
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full motion-reduce:animate-none" />
          ))}
        </div>
      ))}
    </div>
  )
}
