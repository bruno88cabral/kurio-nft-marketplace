import { Link, useLocation } from '@tanstack/react-router'
import { UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSession } from '@/auth/useSession'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface SessionLinkProps {
  className?: string
  /** Classes do placeholder de carregamento (mesma largura do estado final, sem CLS). */
  loadingClassName?: string
  /** Conteúdo visível; recebe o rótulo (nome da conta ou "Entrar"). */
  children?: (label: string) => ReactNode
}

/**
 * Regra de sessão compartilhada por header e tab bar: visitante → "Entrar" (`/login?redirect=`),
 * logado → nome da conta (`/profile`), carregando → placeholder.
 */
export function SessionLink({ className, loadingClassName, children }: SessionLinkProps) {
  const { account, isAuthenticated, isPending } = useSession()
  const href = useLocation({ select: (l) => l.href })

  if (isPending) {
    return <Skeleton aria-hidden className={cn('motion-reduce:animate-none', loadingClassName)} />
  }
  const label = isAuthenticated && account ? account.name : 'Entrar'
  const content = children ? (
    children(label)
  ) : (
    <>
      <UserRound aria-hidden />
      <span className="truncate">{label}</span>
    </>
  )
  if (isAuthenticated) {
    return (
      <Link to="/profile" className={className}>
        {content}
      </Link>
    )
  }
  return (
    <Link to="/login" search={{ redirect: href }} className={className}>
      {content}
    </Link>
  )
}
