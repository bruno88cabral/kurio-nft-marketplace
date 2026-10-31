import { Inbox, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  title: string
  description?: string
  /** Ícone decorativo (padrão `Inbox`). */
  icon?: ReactNode
  /** Ação opcional (ex.: "Limpar filtros", "Adicionar carteira"). */
  action?: ReactNode
  className?: string
}

/** Estado vazio (Figma `9:1865`: "Você ainda não adicionou uma carteira secundária."). */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'border-border-soft flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center',
        className,
      )}
    >
      <span aria-hidden className="text-muted-foreground [&_svg]:size-8">
        {icon ?? <Inbox />}
      </span>
      <p className="text-body font-medium">{title}</p>
      {description && <p className="text-muted-foreground text-caption max-w-sm">{description}</p>}
      {action}
    </div>
  )
}

export interface ErrorStateProps {
  /** Padrão "Não foi possível carregar.". */
  title?: string
  description?: string
  /** Mostra "Tentar novamente". Sem `onRetry`, o botão não aparece. */
  onRetry?: () => void
  /** Retry em andamento: botão com spinner, sem perder o foco. */
  retrying?: boolean
  className?: string
}

/**
 * Estado de erro com retry (não há erro desenhado no Figma; feito com os tokens). Usa
 * `role="alert"` porque aparece depois de uma tentativa de carga; ícone + texto, não só cor.
 */
export function ErrorState({
  title = 'Não foi possível carregar.',
  description,
  onRetry,
  retrying = false,
  className,
}: ErrorStateProps) {
  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn(
        'border-destructive/40 flex flex-col items-center gap-3 rounded-lg border px-6 py-10 text-center',
        className,
      )}
    >
      <TriangleAlert aria-hidden className="text-destructive size-8" />
      <p className="text-body font-medium">{title}</p>
      {description && <p className="text-muted-foreground text-caption max-w-sm">{description}</p>}
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          onClick={() => !retrying && onRetry()}
          aria-disabled={retrying || undefined}
        >
          {retrying ? (
            <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
          ) : (
            <RefreshCw aria-hidden />
          )}
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
