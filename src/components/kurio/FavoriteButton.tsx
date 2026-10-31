import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FavoriteButtonProps {
  /** Estado atual (o consumidor aplica o otimista e o rollback; o botão só reflete). */
  favorited: boolean
  onToggle: () => void
  /** Nome do NFT, para o nome acessível "Favoritar <nome>". */
  nftName: string
  /** `overlay` = 28px sobre a arte do card (Figma `15:5465`); `default` = botão com texto (Detalhe). */
  variant?: 'overlay' | 'default'
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
  const overlay = variant === 'overlay'
  return (
    <button
      type="button"
      aria-pressed={favorited}
      aria-label={overlay ? `Favoritar ${nftName}` : undefined}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'focus-visible:ring-ring/50 focus-visible:border-ring inline-flex items-center justify-center gap-2 border outline-none transition-colors focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50',
        overlay
          ? 'bg-background/70 border-border-soft size-7 rounded-full backdrop-blur-sm hover:bg-background'
          : 'border-border hover:bg-muted h-9 rounded-md px-3 text-sm font-medium',
        favorited ? 'text-text-accent' : 'text-foreground',
        className,
      )}
    >
      <Heart aria-hidden className={cn('size-4', favorited && 'fill-current')} />
      {!overlay && (
        <span>
          Favoritar<span className="sr-only"> {nftName}</span>
        </span>
      )}
    </button>
  )
}
