import { Link } from '@tanstack/react-router'
import { Heart, Home, ScanLine, ShoppingCart, UserRound } from 'lucide-react'
import { OutOfScopeAction } from '@/components/kurio'
import { CartBadge } from '@/features/cart/CartBadge'
import { cartLinkLabel } from '@/features/cart/cartView'
import { useCartCount } from '@/features/cart/useCartCount'
import { cn } from '@/lib/utils'
import { SessionLink } from './SessionLink'

/**
 * A barra tem `h-16` (4rem) e o botão central sobe 1.25rem acima dela; o root reserva esse espaço
 * (+ safe-area) abaixo de `md`, para o fim da página não ficar embaixo da barra.
 */
export const TAB_BAR_PADDING_CLASS = 'pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-0'

/** Item da barra (Figma `Mobile/Início.png`): só o ícone, bege; o atual fica laranja. O nome vai em `sr-only`. */
const item =
  'text-muted-foreground hover:text-foreground aria-[current=page]:text-text-accent focus-visible:ring-ring flex h-16 min-w-0 flex-1 items-center justify-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-inset'

/**
 * Tab bar mobile do Figma: Início, Favoritos, o botão central redondo e laranja (scan), Carrinho
 * (com o badge) e Conta. Favoritos e o scan não têm tela no escopo: são `OutOfScopeAction`
 * ("Em breve"). Conta é o `SessionLink` ("Entrar" para o visitante, o Perfil para quem está logado),
 * que cobre o acesso à conta nas telas sem o header do site (Início no mobile).
 */
export function MobileTabBar() {
  const cartCount = useCartCount()
  return (
    <nav
      aria-label="Navegação principal (mobile)"
      className="bg-card fixed inset-x-0 bottom-0 z-30 rounded-t-[2rem] pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgb(0_0_0/0.35)] md:hidden"
    >
      <ul className="flex h-16 items-stretch px-2">
        <li className="flex min-w-0 flex-1">
          <Link to="/" activeOptions={{ exact: true, includeHash: false, includeSearch: false }} className={item}>
            <Home aria-hidden className="size-6 fill-current" />
            <span className="sr-only">Início</span>
          </Link>
        </li>
        <li className="flex min-w-0 flex-1">
          <OutOfScopeAction variant="ghost" label="Favoritos" className={cn(item, 'h-16 opacity-100')}>
            <Heart aria-hidden className="size-6 fill-current" />
          </OutOfScopeAction>
        </li>
        <li className="flex min-w-0 flex-1 justify-center">
          {/* Botão central: círculo laranja que sobe acima da barra, como no Figma */}
          <OutOfScopeAction
            variant="default"
            label="Escanear"
            className="bg-primary text-primary-foreground hover:bg-primary ring-background focus-visible:ring-ring size-16 -translate-y-5 rounded-full opacity-100 shadow-lg ring-4 focus-visible:ring-4"
          >
            <ScanLine aria-hidden className="size-7" />
          </OutOfScopeAction>
        </li>
        <li className="flex min-w-0 flex-1">
          <Link to="/cart" aria-label={cartLinkLabel(cartCount)} className={item}>
            <span className="relative inline-flex">
              <ShoppingCart aria-hidden className="size-6" />
              <CartBadge count={cartCount} className="-top-1.5 -right-2.5" />
            </span>
          </Link>
        </li>
        <li className="flex min-w-0 flex-1">
          <SessionLink className={item} loadingClassName="m-3 h-10 flex-1 rounded-md">
            {(label) => (
              <>
                <UserRound aria-hidden className="size-6 fill-current" />
                <span className="sr-only">{label}</span>
              </>
            )}
          </SessionLink>
        </li>
      </ul>
    </nav>
  )
}
