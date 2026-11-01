import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Circle } from 'lucide-react'
import { useId, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { deleteWallet, invalidateWallets, updateWallet } from '@/api/wallets'
import { captureSession, isSameSession } from '@/auth/sessionGuard'
import type { Id, Wallet } from '@/contracts'
import { OutOfScopeAction, WalletCard, type WalletCardAction } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { sortWallets } from '@/lib/wallets'
import { ACCOUNT_HEADING_CLASS } from './AccountLayout'
import { RemoveWalletDialog, RenameWalletDialog } from './WalletDialogs'
import { WALLET_MESSAGES, actionErrorMessage } from './validation'

const EMPTY_WALLETS_TITLE = 'Você ainda não adicionou uma carteira.'
/** Texto do Figma `9:1865`, para quem só tem a principal. */
const NO_SECONDARY_TITLE = 'Você ainda não adicionou uma carteira secundária.'

type DialogKind = 'rename' | 'remove'

/** Subtítulo do Figma (`Desktop/Carteiras.png`) abaixo de "Carteira principal". */
const PRIMARY_DESCRIPTION = 'Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.'

interface WalletListProps {
  accountId: Id
  /** `undefined` enquanto carregam (skeleton) ou quando falharam (`error`). */
  wallets: readonly Wallet[] | undefined
  /** Estado de erro do carregamento (ex.: `ErrorState` com "Tentar de novo"). */
  error?: ReactNode
  /** Formulário de nova carteira, na seção "Carteira principal" como no Figma. */
  form: ReactNode
}

/**
 * Carteiras da conta (Figma `Desktop/Carteiras.png`, MYK-1102), sem cards de painel: seção "Carteira
 * principal" (título pequeno, subtítulo, "Adicionar" laranja, a principal e o formulário de nova carteira)
 * e seção "Carteira secundária" (as reservas ou "Você ainda não adicionou uma carteira secundária.").
 * "Adicionar" leva o foco ao formulário. Sem rádio: aqui a principal se escolhe pelo menu. Ações por card:
 * "Definir como principal" (só nas reservas), "Renomear" (diálogo), "Ver no Etherscan" (fora de
 * escopo) e "Remover" (confirmação). A ação em andamento deixa o card com `aria-busy`; o resultado
 * vai para o toast e para uma região `aria-live`.
 */
export function WalletList({ accountId, wallets, error, form }: WalletListProps) {
  const queryClient = useQueryClient()
  const listRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const primaryHeadingId = useId()
  const secondaryHeadingId = useId()
  const addSecondaryHintId = useId()
  const removedRef = useRef(false)
  // `seq` remonta o `<p>` da região viva: a mesma mensagem duas vezes seguidas é anunciada de novo
  const [announcement, setAnnouncement] = useState({ message: '', seq: 0 })
  const [dialog, setDialog] = useState<DialogKind>()
  const [target, setTarget] = useState<Wallet>()

  const announce = (message: string) => setAnnouncement((prev) => ({ message, seq: prev.seq + 1 }))
  const fail = (error: unknown) => {
    const message = actionErrorMessage(error)
    if (message) {
      toast.error(message)
      announce(message)
    }
  }

  // Resposta depois de um logout/troca de conta: sem toast nem invalidação na sessão seguinte
  const promote = useMutation({
    mutationFn: (wallet: Wallet) => updateWallet(wallet.id, { role: 'primary' }),
    onMutate: captureSession,
    onSuccess: async (_wallet, _variables, sameSession) => {
      if (!isSameSession(sameSession)) return
      await invalidateWallets(queryClient, accountId)
      toast.success(WALLET_MESSAGES.promoted)
      announce(WALLET_MESSAGES.promoted)
    },
    onError: (error, _wallet, sameSession) => {
      if (isSameSession(sameSession)) fail(error)
    },
  })

  const remove = useMutation({
    mutationFn: (wallet: Wallet) => deleteWallet(wallet.id),
    onMutate: captureSession,
    onSuccess: async (_data, _wallet, sameSession) => {
      if (!isSameSession(sameSession)) return
      await invalidateWallets(queryClient, accountId)
      removedRef.current = true
      setDialog(undefined)
      toast.success(WALLET_MESSAGES.removed)
      announce(WALLET_MESSAGES.removed)
    },
    onError: (error, _wallet, sameSession) => {
      if (!isSameSession(sameSession)) return
      setDialog(undefined)
      fail(error)
    },
  })

  // Com uma ação pendente, todos os cards ficam ocupados: outra promoção em paralelo deixaria o
  // `aria-busy` só no último card e daria dois toasts
  const busy = promote.isPending || remove.isPending

  const open = (kind: DialogKind, wallet: Wallet) => {
    setTarget(wallet)
    setDialog(kind)
  }

  /**
   * Ao fechar um diálogo aberto pelo menu, o Radix devolveria o foco ao item do menu (já
   * desmontado) e ele cairia no `<body>`. Volta para o gatilho "Ações" da carteira; se ela foi
   * removida, para a lista.
   */
  const restoreFocus = (event: Event) => {
    event.preventDefault()
    const trigger =
      target && !removedRef.current
        ? listRef.current?.querySelector<HTMLElement>(`[data-wallet-id="${CSS.escape(target.id)}"] [aria-haspopup="menu"]`)
        : undefined
    removedRef.current = false
    ;(trigger ?? listRef.current)?.focus()
  }

  const actionsFor = (wallet: Wallet): WalletCardAction[] => [
    ...(wallet.role === 'primary'
      ? []
      : [{ label: 'Definir como principal', onSelect: () => promote.mutate(wallet) }]),
    { label: 'Renomear', onSelect: () => open('rename', wallet) },
    { label: 'Ver no Etherscan', outOfScope: true },
    { label: 'Remover', destructive: true, onSelect: () => open('remove', wallet) },
  ]

  /** "Adicionar": leva o foco ao primeiro campo do formulário de nova carteira. */
  const focusForm = () => {
    formRef.current?.querySelector<HTMLElement>('input:not([type="hidden"]), button[role="combobox"]')?.focus()
  }

  const sorted = wallets ? sortWallets(wallets) : undefined
  const primary = sorted?.find((wallet) => wallet.role === 'primary')
  const reserves = sorted?.filter((wallet) => wallet !== primary) ?? []

  const card = (wallet: Wallet) => (
    <li key={wallet.id} data-wallet-id={wallet.id}>
      <WalletCard wallet={wallet} selectable={false} busy={busy} actions={actionsFor(wallet)} />
    </li>
  )

  return (
    // Recebe o foco depois de uma remoção (o gatilho do menu sumiu junto com o card)
    <div
      ref={listRef}
      tabIndex={-1}
      role="group"
      aria-label="Suas carteiras"
      className="flex flex-col gap-12 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      <div aria-live="polite" className="sr-only">
        <p key={announcement.seq}>{announcement.message}</p>
      </div>

      <section aria-labelledby={primaryHeadingId} className="flex flex-col gap-6">
        <SectionHeader
          headingId={primaryHeadingId}
          title="Carteira principal"
          description={PRIMARY_DESCRIPTION}
          actions={<AddButton onClick={focusForm} />}
        />
        {sorted === undefined ? (
          (error ?? <Skeleton aria-hidden className="h-[83px] w-full rounded-lg" />)
        ) : primary ? (
          // Sem nome próprio: a seção já se chama "Carteira principal" (nome repetido, MYK-1102)
          <ul className="flex flex-col gap-3">
            {card(primary)}
          </ul>
        ) : (
          <p className="text-muted-foreground text-body">{EMPTY_WALLETS_TITLE}</p>
        )}
        <div ref={formRef}>{form}</div>
      </section>

      {/* Com erro de carregamento, a seção secundária não teria o que mostrar */}
      {!(sorted === undefined && error) && (
        <section aria-labelledby={secondaryHeadingId} className="flex flex-col gap-6">
          <SectionHeader
            headingId={secondaryHeadingId}
            title="Carteira secundária"
            description={sorted !== undefined && reserves.length === 0 ? NO_SECONDARY_TITLE : undefined}
            actions={
              <>
                {/* Figma: rádio "Igual à carteira principal", sem contrato (uma carteira não tem par) */}
                <OutOfScopeAction
                  variant="link"
                  className="text-foreground h-11 gap-2 px-0 font-normal opacity-100 [&_svg]:size-5"
                >
                  <Circle aria-hidden className="text-text-accent" />
                  Igual à carteira principal
                </OutOfScopeAction>
                <AddButton onClick={focusForm} secondary describedBy={addSecondaryHintId} />
                {/* O formulário fica sob "Carteira principal" (Figma): o leitor de tela sabe antes para onde vai */}
                <span id={addSecondaryHintId} className="sr-only">
                  Leva ao formulário Nova carteira, acima. Com uma carteira principal, a nova entra como secundária.
                </span>
              </>
            }
          />
          {sorted === undefined ? (
            <Skeleton aria-hidden className="h-5 w-full max-w-md" />
          ) : (
            reserves.length > 0 && (
              <ul aria-label="Carteiras secundárias" className="flex flex-col gap-3">
                {reserves.map(card)}
              </ul>
            )
          )}
        </section>
      )}

      <RenameWalletDialog
        wallet={target}
        open={dialog === 'rename'}
        onOpenChange={(next) => setDialog(next ? 'rename' : undefined)}
        accountId={accountId}
        onRenamed={announce}
        onCloseAutoFocus={restoreFocus}
      />
      <RemoveWalletDialog
        wallet={target}
        open={dialog === 'remove'}
        onOpenChange={(next) => setDialog(next ? 'remove' : undefined)}
        hasOthers={(wallets?.length ?? 0) > 1}
        removing={remove.isPending}
        onConfirm={() => target && remove.mutate(target)}
        onCloseAutoFocus={restoreFocus}
      />
    </div>
  )
}

interface SectionHeaderProps {
  headingId: string
  title: string
  description?: string
  actions: ReactNode
}

/** Título pequeno, subtítulo e ações à direita (Figma); abaixo de `sm` as ações descem. */
function SectionHeader({ headingId, title, description, actions }: SectionHeaderProps) {
  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id={headingId} className={ACCOUNT_HEADING_CLASS}>
          {title}
        </h2>
        {description && <p className="text-muted-foreground text-body">{description}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 sm:-mt-3">{actions}</div>
    </header>
  )
}

/** "Adicionar" em laranja (Figma), com o nome acessível completo. */
function AddButton({
  onClick,
  secondary = false,
  describedBy,
}: {
  onClick: () => void
  secondary?: boolean
  describedBy?: string
}) {
  return (
    <Button
      type="button"
      variant="link"
      onClick={onClick}
      aria-describedby={describedBy}
      className="text-text-accent text-body-lg h-11 px-0 font-bold"
    >
      Adicionar{' '}<span className="sr-only">{secondary ? 'carteira secundária' : 'carteira'}</span>
    </Button>
  )
}
