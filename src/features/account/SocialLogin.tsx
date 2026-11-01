import { OutOfScopeAction } from '@/components/kurio'
import { AUTH_COLUMN_CLASS } from './AuthDialog'

const SOCIAL_CLASS =
  'border-border text-muted-foreground h-10 w-full gap-3 rounded-sm bg-transparent opacity-100 hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent max-md:rounded-lg'

/**
 * Login social do Figma ("Ou continue com", Google e Facebook empilhados, com ícone). Fora do escopo
 * do desafio: `OutOfScopeAction` ("Em breve", `aria-disabled`, tooltip). Aparece no login e no
 * cadastro. A linha do "Ou continue com" vai de borda a borda do modal (no mobile, da coluna).
 */
export function SocialLogin() {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-foreground text-caption flex items-center gap-3">
        <span aria-hidden className="bg-border h-px flex-1" />
        Ou continue com
        <span aria-hidden className="bg-border h-px flex-1" />
      </div>
      <div className={`${AUTH_COLUMN_CLASS} flex flex-col gap-4`}>
        <OutOfScopeAction variant="outline" className={SOCIAL_CLASS}>
          <GoogleIcon />
          Continuar com Google
        </OutOfScopeAction>
        <OutOfScopeAction variant="outline" className={SOCIAL_CLASS}>
          <FacebookIcon />
          Continuar com Facebook
        </OutOfScopeAction>
      </div>
    </div>
  )
}

/** "G" do Google nas quatro cores da marca (o lucide não tem ícones de marca). */
function GoogleIcon() {
  return (
    <svg aria-hidden focusable="false" viewBox="0 0 24 24" className="size-5 shrink-0">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.38l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  )
}

/** "f" do Facebook em azul, como no Figma. */
function FacebookIcon() {
  return (
    <svg aria-hidden focusable="false" viewBox="0 0 24 24" className="size-5 shrink-0">
      <path
        fill="#3B5998"
        d="M13.5 22v-8.2h2.77l.41-3.2H13.5V8.56c0-.93.26-1.56 1.59-1.56h1.7V4.14A22.6 22.6 0 0 0 14.31 4C11.86 4 10.2 5.49 10.2 8.24v2.36H7.4v3.2h2.8V22h3.3Z"
      />
    </svg>
  )
}
