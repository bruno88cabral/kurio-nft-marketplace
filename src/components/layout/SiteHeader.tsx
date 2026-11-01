import { Link, useLocation } from '@tanstack/react-router'
import { ShoppingCart } from 'lucide-react'
import { OutOfScopeAction } from '@/components/kurio'
import { buttonVariants } from '@/components/ui/button'
import { CartBadge } from '@/features/cart/CartBadge'
import { cartLinkLabel } from '@/features/cart/cartView'
import { useCartCount } from '@/features/cart/useCartCount'
import { cn } from '@/lib/utils'
import { BrandLogo } from './BrandLogo'
import { HeaderSearch } from './HeaderSearch'
import { AccountMenu } from './AccountMenu'

/**
 * Item da navegação (Figma): branco, e o ativo em laranja com um sublinhado laranja que pousa
 * sobre a linha divisória do header (`-mb-px` + `border-b-2`).
 */
const navItem =
  'text-foreground text-body lg:text-body-lg -mb-px flex h-full items-center border-b-2 border-transparent px-1 outline-none hover:text-text-accent focus-visible:ring-ring focus-visible:ring-3 focus-visible:ring-inset aria-[current=page]:border-text-accent aria-[current=page]:font-bold aria-[current=page]:text-text-accent'

/**
 * Os "Em breve" da navegação: mesma cara dos links (branco, sem a opacidade de desabilitado), mas
 * sem o laranja no hover, que é o sinal de link ativo/clicável.
 */
const outOfScopeNavItem = cn(navItem, 'hover:text-foreground h-full rounded-none p-0 px-1 font-normal opacity-100')

export function SiteHeader({ className }: { className?: string }) {
  const cartCount = useCartCount()
  // No Detalhe o item ativo é "Mercado" (Figma): o NFT é uma página do catálogo
  const onNftDetail = useLocation({ select: (l) => l.pathname.startsWith('/nfts/') })
  return (
    <header className={cn('bg-background sticky top-0 z-30', className)}>
      {/* A linha divisória fica dentro do container, não em largura total (Figma) */}
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
        <div className="border-border-soft flex h-16 items-center gap-4 border-b md:grid md:grid-cols-[auto_1fr_auto] lg:grid-cols-[1fr_auto_1fr]">
          <BrandLogo className="justify-self-start" />
          <nav aria-label="Principal" className="hidden h-full items-stretch justify-center gap-4 md:flex lg:gap-10">
            <Link to="/" activeOptions={{ exact: true, includeHash: true }} className={navItem}>
              Início
            </Link>
            <Link
              to="/"
              hash="catalogo"
              activeOptions={{ exact: true, includeHash: true }}
              aria-current={onNftDetail ? 'page' : undefined}
              className={navItem}
            >
              Mercado
            </Link>
            <OutOfScopeAction variant="link" className={outOfScopeNavItem}>
              Criadores
            </OutOfScopeAction>
            <OutOfScopeAction variant="link" className={outOfScopeNavItem}>
              Aprenda
            </OutOfScopeAction>
          </nav>
          <div className="ml-auto flex items-center gap-2 justify-self-end md:ml-0 lg:gap-4">
            <HeaderSearch />
            <Link
              to="/cart"
              aria-label={cartLinkLabel(cartCount)}
              className={`${buttonVariants({ variant: 'ghost', size: 'icon' })} relative`}
            >
              <ShoppingCart aria-hidden className="size-5" />
              <CartBadge count={cartCount} className="top-0 right-0" />
            </Link>
            <AccountMenu
              className={`${buttonVariants({ variant: 'outline' })} max-w-40 min-w-24 justify-start sm:max-w-56`}
              visitorClassName={`${buttonVariants({ variant: 'default' })} text-body-lg min-w-24 px-3`}
              loadingClassName="h-9 w-24 rounded-md"
            />
          </div>
        </div>
      </div>
    </header>
  )
}
