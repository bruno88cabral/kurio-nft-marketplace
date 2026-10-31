import { Link } from '@tanstack/react-router'
import { Home, ShoppingCart, Store, UserRound, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { OutOfScopeAction } from '@/components/kurio'
import { cn } from '@/lib/utils'
import { SessionLink } from './SessionLink'

/** A barra tem `h-16` (4rem); o `<main>` reserva esse espaço (+ safe-area) abaixo de `md`. */
export const TAB_BAR_PADDING_CLASS = 'pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0'

const item =
  'text-muted-foreground hover:text-foreground aria-[current=page]:text-text-accent focus-visible:ring-ring flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 text-[0.6875rem] outline-none focus-visible:ring-3 focus-visible:ring-inset [&_svg]:size-5'

function TabLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <>
      {icon}
      <span className="max-w-full truncate">{children}</span>
    </>
  )
}

export function MobileTabBar() {
  return (
    <nav
      aria-label="Navegação principal (mobile)"
      className="border-border bg-background fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex h-16 items-stretch">
        <li className="flex min-w-0 flex-1">
          <Link to="/" activeOptions={{ exact: true, includeHash: true }} className={item}>
            <TabLabel icon={<Home aria-hidden />}>Início</TabLabel>
          </Link>
        </li>
        <li className="flex min-w-0 flex-1">
          <Link
            to="/"
            hash="catalogo"
            activeOptions={{ exact: true, includeHash: true }}
            className={item}
          >
            <TabLabel icon={<Store aria-hidden />}>Mercado</TabLabel>
          </Link>
        </li>
        <li className="flex min-w-0 flex-1">
          <Link to="/cart" className={item}>
            <TabLabel icon={<ShoppingCart aria-hidden />}>Carrinho</TabLabel>
          </Link>
        </li>
        <li className="flex min-w-0 flex-1">
          <OutOfScopeAction variant="ghost" className={cn(item, 'whitespace-normal')}>
            <TabLabel icon={<Users aria-hidden />}>Criadores</TabLabel>
          </OutOfScopeAction>
        </li>
        <li className="flex min-w-0 flex-1">
          <SessionLink className={item} loadingClassName="m-3 h-10 flex-1 rounded-md">
            {(label) => <TabLabel icon={<UserRound aria-hidden />}>{label}</TabLabel>}
          </SessionLink>
        </li>
      </ul>
    </nav>
  )
}
