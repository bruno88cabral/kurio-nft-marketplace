import { cn } from '@/lib/utils'
/**
 * Selo com a soma das quantidades, escondido em 0. É `aria-hidden`: o número já está no `aria-label`
 * do link (`cartLinkLabel`), então o leitor de tela não o lê duas vezes. Posicione-o com `className`.
 */
export function CartBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      aria-hidden
      data-slot="cart-badge"
      className={cn(
        'bg-primary text-primary-foreground pointer-events-none absolute flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] leading-none font-bold tabular-nums',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
