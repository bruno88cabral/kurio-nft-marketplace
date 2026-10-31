import { useNavigate, useRouter } from '@tanstack/react-router'
import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSession } from '@/auth/useSession'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { HeroFeatured } from '@/features/catalog/HeroFeatured'
import { MintJournal } from '@/features/catalog/MintJournal'
import { PromoCards } from '@/features/catalog/PromoCards'
import { dialogCloseTarget } from './authRedirect'

interface AuthDialogProps {
  title: string
  description: string
  /** `redirect` já validado (`validateRedirectSearch`). */
  redirect: string | undefined
  children: ReactNode
}

/**
 * Login e cadastro são rotas (`/login`, `/signup`) que abrem este `Dialog` sobre o fundo do Início.
 * Fechar (X, Esc, clique fora) navega para o `redirect` (ou `/`). Foco preso e `aria-hidden` no
 * resto da página ficam com o Radix. Abaixo de `md` o modal ocupa a tela inteira (acima da tab bar).
 */
export function AuthDialog({ title, description, redirect, children }: AuthDialogProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const { isAuthenticated } = useSession()

  const isProtected = (pathname: string) =>
    router.getMatchedRoutes(pathname)[0].some((route) => route.id === '/_authenticated')

  const close = () => {
    void navigate({ href: dialogCloseTarget(redirect, isAuthenticated, isProtected), replace: true })
  }

  return (
    <>
      <AuthBackdrop />
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent
          className="inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-6 overflow-y-auto rounded-none px-4 pt-14 pb-[calc(1.5rem+env(safe-area-inset-bottom))] ring-0 sm:max-w-none md:inset-auto md:top-1/2 md:left-1/2 md:h-auto md:max-h-[calc(100dvh-4rem)] md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:p-8 md:ring-1"
        >
          <DialogHeader>
            <DialogTitle asChild>
              <h1 className="text-heading">{title}</h1>
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Fundo do modal: as seções do Início que não dependem do `search` do catálogo. O catálogo
 * (`CatalogSection`) lê o search da rota `/` via `getRouteApi('/')` e não monta fora dela.
 */
function AuthBackdrop() {
  return (
    <div className="flex flex-col">
      <HeroFeatured />
      <PromoCards />
      <MintJournal />
    </div>
  )
}

/** Erro do formulário inteiro (401, falha transitória): ícone + texto, anunciado. */
export function FormAlert({ message }: { message: string | undefined }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="border-destructive/40 bg-destructive/5 text-destructive text-caption flex items-start gap-2 rounded-md border px-3 py-2"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  )
}
