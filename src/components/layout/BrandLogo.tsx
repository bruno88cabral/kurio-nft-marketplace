import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export function BrandLogo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      aria-label="Kurio, ir para o Início"
      className={cn(
        'text-foreground focus-visible:ring-ring text-body-lg rounded-md font-bold tracking-wide outline-none focus-visible:ring-3',
        className,
      )}
    >
      KURIO
    </Link>
  )
}
