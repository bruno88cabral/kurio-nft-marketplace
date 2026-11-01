import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FavoriteButtonProps {
  /** Estado atual (o consumidor aplica o otimista e o rollback; o botão só reflete). */
  favorited: boolean
  onToggle: () => void
  /** Nome do NFT, para o nome acessível "Favoritar <nome>". */
  nftName: string
  /**
   * `overlay` = 28px sobre a arte do card (Figma `15:5465`); `default` = botão com texto e contorno
   * laranja (Detalhe desktop); `round` = botão redondo de 44 px, só o coração (Detalhe mobile).
   */
  variant?: 'overlay' | 'default' | 'round'
  disabled?: boolean
  className?: string
}

/**
 * Favoritar funcional (ruling R-1 da MYK-1049): toggle com `aria-pressed`. O nome acessível é
 * fixo ("Favoritar X"); o estado sai do `aria-pressed`, e o coração preenchido (forma, não só cor)
 * mostra o estado visualmente.
 */
export function FavoriteButton({
  favorited,
  onToggle,
  nftName,
  variant = 'overlay',
  disabled,
  className,
}: FavoriteButtonProps) {
  const iconOnly = variant !== 'default'
  return (
    <button
      type="button"
      aria-pressed={favorited}
      aria-label={iconOnly ? `Favoritar ${nftName}` : undefined}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'focus-visible:ring-ring focus-visible:border-ring inline-flex items-center justify-center gap-2 border outline-none transition-colors focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50',
        variant === 'overlay' && 'bg-background/70 border-border-soft size-7 rounded-full backdrop-blur-sm hover:bg-background',
        variant === 'round' && 'bg-card border-border-soft hover:bg-muted text-text-accent size-11 rounded-full',
        variant === 'default' && 'border-primary text-text-accent hover:bg-muted h-10 rounded-md px-4 text-sm font-medium',
        variant === 'overlay' && (favorited ? 'text-text-accent' : 'text-foreground'),
        className,
      )}
    >
      <Heart aria-hidden className={cn(variant === 'round' ? 'size-5' : 'size-4', favorited && 'fill-current')} />
      {!iconOnly && (
        <span>
          Favoritar<span className="sr-only"> {nftName}</span>
        </span>
      )}
    </button>
  )
}
