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
 * Seleção de edição (single), em pílulas com contorno (Figma). Edição com `available` 0 fica indisponível: desabilitada,
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
              // Figma: pílulas com contorno; a escolhida tem o contorno e o texto laranja (mais grosso e em
              // negrito, para não depender só da cor), sem preenchimento. 44 px de alvo no toque (celular e tablet), 32 a partir de `lg`
              'border-border-soft text-foreground h-auto min-h-11 min-w-14 flex-col gap-0 rounded-full px-3 py-1 text-caption lg:min-h-8',
              'data-[state=on]:border-text-accent data-[state=on]:text-text-accent data-[state=on]:bg-transparent data-[state=on]:hover:bg-muted data-[state=on]:font-bold data-[state=on]:ring-text-accent data-[state=on]:ring-1',
            )}
          >
            <span className={cn(unavailable && 'line-through')}>{editionLabel(edition.kind)}</span>
            {unavailable && ' '}
            {unavailable && <span className="text-tiny font-normal">Esgotada</span>}
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
