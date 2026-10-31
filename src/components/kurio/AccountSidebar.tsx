import { Link } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OutOfScopeAction } from './OutOfScopeAction'

/** Seções navegáveis da conta (as demais do Figma são fora de escopo). */
export type AccountSection = 'profile' | 'wallets'

export interface AccountSidebarProps {
  /** Seção atual: barra laranja à esquerda + `aria-current="page"` (não depende só da cor do texto). */
  active: AccountSection
  onLogout: () => void
  /** Desabilita "Sair" enquanto o logout está em andamento. */
  loggingOut?: boolean
  className?: string
}

const OUT_OF_SCOPE_ITEMS = ['Atividade', 'Lista de interesse', 'Ofertas', 'Arquivos baixados', 'Suporte'] as const

const itemClass =
  'relative flex h-10 w-full items-center justify-start rounded-md px-4 text-body font-normal outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50'

/**
 * Menu lateral da conta (Figma `70420:4594`): Dados do perfil, Carteiras, itens fora de escopo
 * (`OutOfScopeAction`) e Sair. A navegação é por `Link`; o estado ativo vem da prop `active`.
 */
export function AccountSidebar({ active, onLogout, loggingOut = false, className }: AccountSidebarProps) {
  return (
    <nav aria-label="Conta" data-slot="account-sidebar" className={cn('flex flex-col gap-1', className)}>
      <ul className="flex flex-col gap-1">
        <li>
          <SectionLink section="profile" active={active} />
        </li>
        <li>
          <SectionLink section="wallets" active={active} />
        </li>
        {OUT_OF_SCOPE_ITEMS.map((label) => (
          <li key={label}>
            <OutOfScopeAction side="right" className={cn(itemClass, 'text-muted-foreground')}>
              {label}
            </OutOfScopeAction>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onLogout}
        disabled={loggingOut}
        className={cn(itemClass, 'hover:bg-muted text-foreground mt-2 gap-2 disabled:opacity-50')}
      >
        <LogOut aria-hidden className="size-4" />
        Sair
      </button>
    </nav>
  )
}

const SECTION = {
  profile: { to: '/profile', label: 'Dados do perfil' },
  wallets: { to: '/wallets', label: 'Carteiras' },
} as const

function SectionLink({ section, active }: { section: AccountSection; active: AccountSection }) {
  const isActive = section === active
  return (
    <Link
      to={SECTION[section].to}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        itemClass,
        'hover:bg-muted',
        isActive
          ? 'bg-muted text-foreground font-medium before:bg-primary before:absolute before:inset-y-1 before:left-0 before:w-1 before:rounded-full'
          : 'text-muted-foreground',
      )}
    >
      {SECTION[section].label}
    </Link>
  )
}
