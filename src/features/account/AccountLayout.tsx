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
  /** Único `<h1>` da página: título pequeno, como no Figma ("Perfil do colecionador"). */
  title: string
  /**
   * Deixa o `<h1>` só para o leitor de tela (Carteiras: o Figma abre com os títulos das seções,
   * "Carteira principal" e "Carteira secundária", que são `<h2>`).
   */
  hideTitle?: boolean
  children: ReactNode
}

/** Caixa da página da conta. */
export const ACCOUNT_PAGE_CLASS = 'mx-auto w-full max-w-7xl px-4 pt-4 pb-8 md:px-6 md:py-8'

/** Título pequeno das páginas e seções da conta (Figma: "Perfil do colecionador", "Alterar senha"). */
export const ACCOUNT_HEADING_CLASS = 'text-body-lg font-bold'

/** Rótulo dos campos da conta: como no Figma, texto de corpo, branco e sem negrito. */
export const ACCOUNT_LABEL_CLASS = 'text-body font-normal'

/**
 * Página da conta (Perfil, Carteiras), sem cards (Figma, MYK-1102). Desktop (`lg`): `AccountSidebar`
 * à esquerda ("Meu perfil", itens com ícone, os fora de escopo e "Sair"). Mobile e tablet: abas
 * Perfil/Carteiras (`aria-current`) e "Sair" visível no topo, sem os itens fora de escopo (o Figma só
 * desenha o desktop). Sair = `useSignOut` (`endSession('logout')` + toast "Você saiu da conta." + `/`).
 */
export function AccountLayout({ active, title, hideTitle = false, children }: AccountLayoutProps) {
  const { signOut, pending } = useSignOut()
  const onLogout = () => void signOut()

  return (
    <div className={cn(ACCOUNT_PAGE_CLASS, 'lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-7')}>
      <AccountSidebar active={active} onLogout={onLogout} loggingOut={pending} className="hidden self-start lg:flex" />
      <div className="flex min-w-0 flex-col gap-6">
        <AccountMobileNav active={active} onLogout={onLogout} loggingOut={pending} className="lg:hidden" />
        <h1 className={cn(ACCOUNT_HEADING_CLASS, hideTitle && 'sr-only')}>{title}</h1>
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
