import { Link } from '@tanstack/react-router'
import { ChevronDown, LogOut, UserRound, Wallet } from 'lucide-react'
import { useSession } from '@/auth/useSession'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { focusMainContent, useSignOut } from '@/features/account/useSignOut'
import { cn } from '@/lib/utils'
import { SessionLink } from './SessionLink'

interface AccountMenuProps {
  className?: string
  loadingClassName?: string
}

/**
 * Conta no header: visitante e carregando delegam ao `SessionLink` ("Entrar" / skeleton);
 * logado abre um menu com Perfil, Carteiras e Sair. A tab bar mobile continua com o `SessionLink`.
 */
export function AccountMenu({ className, loadingClassName }: AccountMenuProps) {
  const { account, isAuthenticated } = useSession()
  const { signOut, pending } = useSignOut()

  if (!isAuthenticated || !account) {
    return <SessionLink className={className} loadingClassName={loadingClassName} />
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn(className, 'gap-1.5')}>
          <UserRound aria-hidden />
          <span className="truncate">{account.name}</span>
          <ChevronDown aria-hidden className="ml-auto" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-60"
        onCloseAutoFocus={(event) => {
          // Saindo, o menu desmonta junto com o gatilho (o foco cairia no `<body>`); o Radix chama
          // isto depois do unmount, quando ele já não prende o foco
          if (!pending) return
          event.preventDefault()
          focusMainContent()
        }}
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-foreground truncate">{account.name}</span>
          <span className="text-muted-foreground truncate text-xs font-normal">{account.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <UserRound aria-hidden />
            Perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/wallets">
            <Wallet aria-hidden />
            Carteiras
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={(event) => {
            // Mantém o menu aberto com o item desabilitado enquanto sai
            event.preventDefault()
            void signOut()
          }}
        >
          <LogOut aria-hidden />
          {pending ? 'Saindo…' : 'Sair'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
