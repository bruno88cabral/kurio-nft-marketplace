import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface AccountPanelProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

/** Bloco de uma página da conta: `<section>` nomeada pelo `<h2>` (ex.: "Dados do perfil", "Alterar senha"). */
export function AccountPanel({ title, description, children, className }: AccountPanelProps) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className={cn('border-border-soft flex flex-col gap-6 rounded-xl border p-4 md:p-6', className)}
    >
      <header className="flex flex-col gap-1">
        <h2 id={headingId} className="text-body-lg font-semibold">
          {title}
        </h2>
        {description && <p className="text-muted-foreground text-caption">{description}</p>}
      </header>
      {children}
    </section>
  )
}
