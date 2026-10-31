import { Link } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { AccountSidebar, type AccountSection } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSignOut } from './useSignOut'

export interface AccountLayoutProps {
  /** Seção atual (sidebar no desktop, abas no mobile/tablet). */
  active: AccountSection
  /** Único `<h1>` da página. */
  title: string
  description?: string
  children: ReactNode
}

/** Caixa da página da conta (compartilhada com o skeleton, para não haver salto). */
export const ACCOUNT_PAGE_CLASS = 'mx-auto w-full max-w-7xl px-4 pt-4 pb-8 md:px-6 md:py-8'

/**
 * Página da conta (Perfil, Carteiras). Desktop (`lg`): `AccountSidebar` à esquerda com os itens fora
 * de escopo e "Sair". Mobile e tablet: abas Perfil/Carteiras (`aria-current`) e "Sair" visível no
 * topo, sem os itens fora de escopo (o Figma só desenha o desktop). Sair = `useSignOut`
 * (`endSession('logout')` + toast "Você saiu da conta." + `/`).
 */
export function AccountLayout({ active, title, description, children }: AccountLayoutProps) {
  const { signOut, pending } = useSignOut()
  const onLogout = () => void signOut()

  return (
    <div className={cn(ACCOUNT_PAGE_CLASS, 'lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12')}>
      <AccountSidebar active={active} onLogout={onLogout} loggingOut={pending} className="hidden self-start lg:flex" />
      <div className="flex min-w-0 flex-col gap-6">
        <AccountMobileNav active={active} onLogout={onLogout} loggingOut={pending} className="lg:hidden" />
        <header className="flex flex-col gap-1">
          <h1 className="text-heading">{title}</h1>
          {description && <p className="text-muted-foreground text-body">{description}</p>}
        </header>
        {children}
      </div>
    </div>
  )
}

const MOBILE_SECTIONS = [
  { section: 'profile', to: '/profile', label: 'Perfil' },
  { section: 'wallets', to: '/wallets', label: 'Carteiras' },
] as const satisfies readonly { section: AccountSection; to: string; label: string }[]

interface AccountMobileNavProps {
  active: AccountSection
  onLogout: () => void
  loggingOut: boolean
  className?: string
}

/** Abas da conta abaixo de `lg`: a ativa tem fundo, peso e `aria-current="page"` (não só cor). */
function AccountMobileNav({ active, onLogout, loggingOut, className }: AccountMobileNavProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <nav aria-label="Conta" className="min-w-0">
        <ul className="bg-muted flex gap-1 rounded-lg p-1">
          {MOBILE_SECTIONS.map(({ section, to, label }) => {
            const isActive = section === active
            return (
              <li key={section}>
                <Link
                  to={to}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'text-body focus-visible:ring-ring/50 flex h-9 items-center rounded-md px-4 outline-none transition-colors focus-visible:ring-3',
                    isActive
                      ? 'bg-background text-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <Button
        type="button"
        variant="outline"
        onClick={onLogout}
        disabled={loggingOut}
        aria-busy={loggingOut || undefined}
        className="h-11 shrink-0"
      >
        <LogOut aria-hidden />
        {loggingOut ? 'Saindo…' : 'Sair'}
      </Button>
    </div>
  )
}
