import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export function BrandLogo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      aria-label="Kurio, ir para o Início"
      className={cn(
        'text-text-accent focus-visible:ring-ring rounded-md text-xl font-bold tracking-[0.2em] outline-none focus-visible:ring-3',
        className,
      )}
    >
      KURIO
    </Link>
  )
}
