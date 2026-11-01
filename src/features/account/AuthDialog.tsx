import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft, CircleAlert, XIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSession } from '@/auth/useSession'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { HeroFeatured } from '@/features/catalog/HeroFeatured'
import { MintJournal } from '@/features/catalog/MintJournal'
import { PromoCards } from '@/features/catalog/PromoCards'
import { cn } from '@/lib/utils'
import { dialogCloseTarget } from './authRedirect'

export type AuthMode = 'login' | 'signup'

/** Textos do Figma (Desktop/Login.png, Desktop/Cadastro.png, Mobile/Login.png, Mobile/Cadastro.png). */
const COPY: Record<AuthMode, { title: string; description: string }> = {
  login: {
    title: 'Entrar',
    description: 'Entre para gerenciar sua carteira, coleção e perfil de criador.',
  },
  signup: {
    title: 'Criar perfil de colecionador',
    description: 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.',
  },
}

/**
 * Coluna dos campos: no mobile ocupa a largura (a margem vem do `DialogContent`); no desktop é
 * mais estreita e centralizada dentro do modal largo, como no Figma.
 */
export const AUTH_COLUMN_CLASS = 'mx-auto w-full md:max-w-[340px]'

/** Campo do Figma: alto e arredondado no mobile, mais baixo e reto no desktop; foco com borda laranja. */
export const AUTH_INPUT_CLASS =
  'bg-background dark:bg-background border-border h-12 rounded-xl px-4 focus-visible:border-primary md:h-10 md:rounded-sm md:px-4'

/**
 * Rótulo visível e discreto acima do campo. O Figma só desenha o placeholder, que some ao digitar:
 * o rótulo fica por acessibilidade (WCAG 3.3.2), como decidiu a MYK-1097.
 */
export const AUTH_LABEL_CLASS = 'text-muted-foreground font-normal'

/** Botão principal: alto e bem arredondado no mobile (Figma), compacto no desktop. */
export const AUTH_SUBMIT_CLASS = 'text-body-lg md:text-body h-14 w-full rounded-xl font-bold md:h-11 md:rounded-sm'

interface AuthDialogProps {
  mode: AuthMode
  /** `redirect` já validado (`validateRedirectSearch`). */
  redirect: string | undefined
  children: ReactNode
}

/**
 * Login e cadastro são rotas (`/login`, `/signup`) que abrem este `Dialog` sobre o fundo do Início.
 * Fechar (X, "Voltar", Esc, clique fora) navega para o `redirect` (ou `/`). Foco preso e
 * `aria-hidden` no resto da página ficam com o Radix.
 *
 * - **Desktop (`md`+):** modal largo `#241612` com borda inferior laranja, abas "Entrar | Criar
 *   conta" (links entre `/login` e `/signup`, mantendo o `redirect`), texto de apoio e X laranja.
 *   O fundo só escurece, sem desfoque.
 * - **Mobile:** página inteira `#140d0a` com "KURIO" e o título; as rotas ligam
 *   `staticData.hideMobileChrome` (sem header nem tab bar). O Figma não tem X: fica um "Voltar"
 *   discreto no canto, que fecha como o X, e o Esc continua valendo.
 */
export function AuthDialog({ mode, redirect, children }: AuthDialogProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const { isAuthenticated } = useSession()
  const copy = COPY[mode]

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
          showCloseButton={false}
          overlayClassName="bg-black/50 supports-backdrop-filter:backdrop-blur-none"
          // O primeiro elemento focável agora é o "Voltar" (mobile) ou a aba "Entrar" (desktop): o
          // foco inicial continua no primeiro campo, como antes das abas
          onOpenAutoFocus={(event) => {
            const field = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLInputElement>('form input')
            if (!field) return
            event.preventDefault()
            field.focus()
          }}
          className={cn(
            // Mobile: página inteira
            'bg-background inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-6 overflow-y-auto rounded-none px-7 pt-24 pb-[calc(2rem+env(safe-area-inset-bottom))] ring-0 sm:max-w-none',
            // Desktop: modal largo com a borda inferior laranja
            'md:bg-card md:border-primary md:inset-auto md:top-1/2 md:left-1/2 md:h-auto md:max-h-[calc(100dvh-4rem)] md:max-w-[500px] md:-translate-x-1/2 md:-translate-y-1/2 md:gap-6 md:rounded-md md:border-b-8 md:px-10 md:pt-14 md:pb-14',
          )}
        >
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Voltar"
              className="text-muted-foreground hover:text-foreground absolute top-4 left-4 md:hidden"
            >
              <ChevronLeft aria-hidden className="size-6" />
            </Button>
          </DialogClose>

          <p aria-hidden className="text-foreground text-center text-5xl font-bold tracking-[0.12em] md:hidden">
            KURIO
          </p>

          <AuthTabs mode={mode} redirect={redirect} />

          <div className="flex flex-col gap-2 text-center max-md:mt-10">
            <DialogTitle asChild>
              <h1 className="text-heading font-bold max-md:text-lg md:sr-only">{copy.title}</h1>
            </DialogTitle>
            <DialogDescription className="text-foreground text-caption mx-auto max-w-[460px] max-md:sr-only">
              {copy.description}
            </DialogDescription>
          </div>

          {children}

          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Fechar"
              className="text-text-accent hover:text-text-accent absolute top-3 right-3 max-md:hidden"
            >
              <XIcon aria-hidden className="size-5" />
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  )
}

const TAB_CLASS =
  'focus-visible:ring-ring rounded-sm px-1 outline-none hover:underline underline-offset-4 focus-visible:ring-3 aria-[current=page]:text-text-accent aria-[current=page]:hover:no-underline'

/**
 * Abas do desktop (Figma): "Entrar | Criar conta", a ativa em laranja. São links (`aria-current`)
 * entre `/login` e `/signup`, que mantêm o `redirect`. No mobile o rodapé do formulário faz a troca.
 */
function AuthTabs({ mode, redirect }: { mode: AuthMode; redirect: string | undefined }) {
  return (
    <nav aria-label="Entrar ou criar conta" className="text-heading flex items-center justify-center gap-2 max-md:hidden">
      <Link to="/login" search={{ redirect }} replace aria-current={mode === 'login' ? 'page' : undefined} className={TAB_CLASS}>
        Entrar
      </Link>
      <span aria-hidden className="bg-primary h-6 w-px" />
      <Link to="/signup" search={{ redirect }} replace aria-current={mode === 'signup' ? 'page' : undefined} className={TAB_CLASS}>
        Criar conta
      </Link>
    </nav>
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
