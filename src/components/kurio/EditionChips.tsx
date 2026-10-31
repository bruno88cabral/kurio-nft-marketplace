import type { NftEdition, NftEditionKind } from '@/contracts'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { editionLabel, sortEditions } from '@/lib/editions'
import { cn } from '@/lib/utils'

export interface EditionChipsProps {
  /** Edições do NFT (`Nft.editions`); são exibidas na ordem 1/1, 1/10, 1/50, ABERTA. */
  editions: readonly Pick<NftEdition, 'kind' | 'available'>[]
  value: NftEditionKind | undefined
  onValueChange: (kind: NftEditionKind) => void
  /** Desabilita o grupo inteiro (ex.: enquanto adiciona ao carrinho). */
  disabled?: boolean
  /** Nome acessível do grupo (padrão "Edição"). */
  label?: string
  className?: string
}

/**
 * Seleção de edição (single). Edição com `available` 0 fica indisponível: desabilitada,
 * riscada e com o texto "Esgotada" visível (não depende só de cor). Clicar no chip já
 * selecionado não desmarca (o Radix permitiria; aqui sempre há uma edição escolhida).
 */
export function EditionChips({
  editions,
  value,
  onValueChange,
  disabled = false,
  label = 'Edição',
  className,
}: EditionChipsProps) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      spacing={2}
      aria-label={label}
      value={value ?? ''}
      onValueChange={(next) => {
        if (next) onValueChange(next as NftEditionKind)
      }}
      disabled={disabled}
      className={cn('flex-wrap', className)}
    >
      {sortEditions(editions).map((edition) => {
        const unavailable = edition.available <= 0
        return (
          <ToggleGroupItem
            key={edition.kind}
            value={edition.kind}
            disabled={disabled || unavailable}
            data-unavailable={unavailable || undefined}
            className={cn(
              'h-auto min-h-9 min-w-16 flex-col gap-0 rounded-md px-3 py-1.5 text-caption',
              'data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary',
            )}
          >
            <span className={cn('font-bold', unavailable && 'line-through')}>{editionLabel(edition.kind)}</span>
            {unavailable && ' '}
            {unavailable && <span className="text-tiny font-normal">Esgotada</span>}
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
