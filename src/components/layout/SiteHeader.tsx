import { Link } from '@tanstack/react-router'
import { ShoppingCart } from 'lucide-react'
import { OutOfScopeAction } from '@/components/kurio'
import { buttonVariants } from '@/components/ui/button'
import { BrandLogo } from './BrandLogo'
import { HeaderSearch } from './HeaderSearch'
import { AccountMenu } from './AccountMenu'

const navLink =
  'text-body text-muted-foreground hover:text-foreground aria-[current=page]:text-text-accent focus-visible:ring-ring rounded-md px-2 py-1 outline-none focus-visible:ring-3'

export function SiteHeader() {
  return (
    <header className="border-border bg-background sticky top-0 z-30 border-b">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 md:px-6">
        <BrandLogo />
        <nav aria-label="Principal" className="hidden items-center gap-2 md:flex">
          <Link to="/" activeOptions={{ exact: true, includeHash: true }} className={navLink}>
            Início
          </Link>
          <Link
            to="/"
            hash="catalogo"
            activeOptions={{ exact: true, includeHash: true }}
            className={navLink}
          >
            Mercado
          </Link>
          <OutOfScopeAction variant="link" className="text-muted-foreground">
            Criadores
          </OutOfScopeAction>
          <OutOfScopeAction variant="link" className="text-muted-foreground">
            Aprenda
          </OutOfScopeAction>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <HeaderSearch />
          <Link
            to="/cart"
            aria-label="Carrinho"
            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
          >
            <ShoppingCart aria-hidden />
          </Link>
          <AccountMenu
            className={`${buttonVariants({ variant: 'outline' })} max-w-40 min-w-24 justify-start sm:max-w-56`}
            loadingClassName="h-9 w-24 rounded-md"
          />
        </div>
      </div>
    </header>
  )
}
