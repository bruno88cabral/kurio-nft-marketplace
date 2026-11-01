import { Link } from '@tanstack/react-router'
import {
  ChartSpline,
  Heart,
  HardDriveDownload,
  LogOut,
  MapPin,
  ShoppingCart,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useId } from 'react'
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

const OUT_OF_SCOPE_ITEMS: readonly { label: string; icon: LucideIcon }[] = [
  { label: 'Atividade', icon: ShoppingCart },
  { label: 'Lista de interesse', icon: Heart },
  { label: 'Ofertas', icon: ChartSpline },
  { label: 'Arquivos baixados', icon: HardDriveDownload },
  { label: 'Suporte', icon: TriangleAlert },
]

const itemClass =
  'relative flex h-11 w-full items-center justify-start gap-3 rounded-none px-6 text-body font-normal text-text-accent outline-none transition-colors focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring [&_svg]:size-5 [&_svg]:shrink-0'

/**
 * Menu lateral da conta (Figma `Desktop/Perfil do Colecionador.png` e `Carteiras.png`, MYK-1102): painel
 * `#241612` com "Meu perfil", itens laranja com ícone (Dados do perfil, Carteiras e os fora de escopo como
 * `OutOfScopeAction`), o ativo com barra laranja à esquerda e sem fundo, e "Sair" em negrito abaixo de uma linha.
 */
export function AccountSidebar({ active, onLogout, loggingOut = false, className }: AccountSidebarProps) {
  const titleId = useId()
  return (
    <nav aria-labelledby={titleId} data-slot="account-sidebar" className={cn('bg-card flex flex-col pt-4', className)}>
      <p id={titleId} className="text-foreground text-body-lg px-4 pb-2 font-bold">
        Meu perfil
      </p>
      <ul className="flex flex-col gap-1 pb-2">
        <li>
          <SectionLink section="profile" active={active} />
        </li>
        <li>
          <SectionLink section="wallets" active={active} />
        </li>
        {OUT_OF_SCOPE_ITEMS.map(({ label, icon: Icon }) => (
          <li key={label}>
            <OutOfScopeAction side="right" className={cn(itemClass, 'opacity-100 hover:text-text-accent')}>
              <Icon aria-hidden />
              {label}
            </OutOfScopeAction>
          </li>
        ))}
      </ul>
      <div className="border-border-soft border-t py-2">
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          aria-busy={loggingOut || undefined}
          className={cn(itemClass, 'hover:bg-muted font-bold disabled:opacity-50')}
        >
          <LogOut aria-hidden />
          {loggingOut ? 'Saindo…' : 'Sair'}
        </button>
      </div>
    </nav>
  )
}

const SECTION = {
  profile: { to: '/profile', label: 'Dados do perfil', icon: UserRound },
  wallets: { to: '/wallets', label: 'Carteiras', icon: MapPin },
} as const

function SectionLink({ section, active }: { section: AccountSection; active: AccountSection }) {
  const isActive = section === active
  const { to, label, icon: Icon } = SECTION[section]
  return (
    <Link
      to={to}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        itemClass,
        // Ativo sem fundo (Figma): só a barra laranja à esquerda e o peso
        isActive
          ? 'before:bg-primary font-medium before:absolute before:inset-y-0 before:left-0 before:w-1.5'
          : 'hover:bg-muted',
      )}
    >
      <Icon aria-hidden />
      {label}
    </Link>
  )
}
