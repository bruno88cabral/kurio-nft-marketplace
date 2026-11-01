import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { nftFacetsQuery } from '@/api/nfts'
import type { NftFacets } from '@/contracts'
import { Check } from 'lucide-react'
import { Checkbox as CheckboxPrimitive, RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { activeFilterCount, CLEAR_SIDEBAR_FILTERS, type CatalogSearch } from '@/lib/catalogSearch'
import { formatEth } from '@/lib/eth'
import { priceRangePatch, sliderBounds, sliderValue, stepsToEth, type SliderRange } from '@/lib/priceRange'
import { cn } from '@/lib/utils'
import { networkLabel } from '@/lib/wallets'
import { useCatalogSearch } from './useCatalogSearch'

const ALL_NETWORKS = 'all'

const groupTitle = 'text-body-lg text-foreground font-bold'

/**
 * Item de filtro sem checkbox nem rádio visíveis (Figma): a linha inteira é o controle
 * (`role="checkbox"`/`role="radio"` do Radix, com o nome vindo do texto). O ativo fica em laranja
 * e, para não depender só de cor (§8), em negrito e com um ✓ no recuo à esquerda.
 */
const optionRow = cn(
  'group/option text-muted-foreground text-body flex w-full items-center gap-1.5 rounded-sm py-1.5 text-left tracking-wide',
  'hover:text-foreground focus-visible:ring-ring outline-none focus-visible:ring-3',
  'data-[state=checked]:text-text-accent data-[state=checked]:font-bold',
)

function OptionMark() {
  return (
    <Check
      aria-hidden
      className="size-3.5 shrink-0 opacity-0 group-data-[state=checked]/option:opacity-100"
      strokeWidth={3}
    />
  )
}

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
    <div data-slot="catalog-filters" className={cn('flex flex-col gap-8', className)}>
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
  const selected = new Set(search.collections ?? [])
  const toggle = (name: string, checked: boolean) => {
    const next = new Set(selected)
    if (checked) next.add(name)
    else next.delete(name)
    onChange({ collections: [...next] })
  }

  return (
    <fieldset className="flex flex-col">
      <legend className={cn(groupTitle, 'mb-2')}>Coleções</legend>
      {facets.collections.length === 0 && <p className="text-muted-foreground text-caption">Nenhuma coleção.</p>}
      {facets.collections.map(({ name, count }) => (
        <CheckboxPrimitive.Root
          key={name}
          checked={selected.has(name)}
          onCheckedChange={(checked) => toggle(name, checked === true)}
          className={optionRow}
        >
          <OptionMark />
          <span className="min-w-0 flex-1 truncate">{name}</span>
          <span className="text-foreground font-bold tabular-nums group-data-[state=checked]/option:text-text-accent">
            ({count})
          </span>
        </CheckboxPrimitive.Root>
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
      <div className="pl-5">
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
      </div>
      <div className="flex flex-col items-start gap-2 pl-5">
        <p className="text-body tabular-nums">{text}</p>
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          className="font-bold"
          onClick={() => onApply(priceRangePatch(draft, facets.price))}
        >
          Aplicar
        </Button>
      </div>
    </div>
  )
}

function NetworkFilter({ facets, search, onChange }: FilterProps) {
  const legendId = useId()
  const total = facets.networks.reduce((sum, n) => sum + n.count, 0)
  const options = [
    { value: ALL_NETWORKS, label: 'Todas', count: total },
    ...facets.networks.map((n) => ({ value: n.network, label: networkLabel(n.network), count: n.count })),
  ]

  return (
    <fieldset className="flex flex-col">
      <legend id={legendId} className={cn(groupTitle, 'mb-2')}>
        Rede
      </legend>
      {/* O `radiogroup` também ganha o nome (não só o `fieldset`) */}
      <RadioGroupPrimitive.Root
        aria-labelledby={legendId}
        value={search.network ?? ALL_NETWORKS}
        onValueChange={(value) =>
          onChange({ network: value === ALL_NETWORKS ? undefined : (value as NonNullable<CatalogSearch['network']>) })
        }
        className="flex flex-col"
      >
        {options.map((o) => (
          <RadioGroupPrimitive.Item key={o.value} value={o.value} className={optionRow}>
            <OptionMark />
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            <span className="tabular-nums">({o.count})</span>
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>
    </fieldset>
  )
}

function FiltersSkeleton() {
  // Mesmas linhas do conteúdo pronto: título (24 px + 8) e itens de 33 px (texto de 21 + py-1.5)
  return (
    <div aria-hidden className="flex flex-col gap-8">
      {[5, 3, 5].map((rows, g) => (
        <div key={g} className="flex flex-col">
          <Skeleton className="mb-2 h-6 w-28" />
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="my-1.5 h-[21px] w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}
