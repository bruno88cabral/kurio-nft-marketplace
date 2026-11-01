import { Link } from '@tanstack/react-router'

export const AUTH_LINK_CLASS =
  'focus-visible:ring-ring rounded-sm font-medium underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3'

interface AuthSwitchLinkProps {
  prompt: string
  label: string
  to: '/login' | '/signup'
  redirect: string | undefined
}

/**
 * Rodapé do mobile (Figma): "Novo na Kurio? Crie uma conta" / "Já tem uma conta? Entre". No desktop
 * a troca é pelas abas do modal, então o rodapé some a partir de `md`. Mantém o `redirect`.
 */
export function AuthSwitchLink({ prompt, label, to, redirect }: AuthSwitchLinkProps) {
  return (
    <p className="text-muted-foreground text-body text-center md:hidden">
      {prompt}{' '}
      <Link to={to} search={{ redirect }} replace className={AUTH_LINK_CLASS}>
        {label}
      </Link>
    </p>
  )
}
