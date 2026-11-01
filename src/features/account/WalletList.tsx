import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Wallet as WalletIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { deleteWallet, invalidateWallets, updateWallet } from '@/api/wallets'
import { captureSession, isSameSession } from '@/auth/sessionGuard'
import type { Id, Wallet } from '@/contracts'
import { EmptyState, WalletCard, type WalletCardAction } from '@/components/kurio'
import { Skeleton } from '@/components/ui/skeleton'
import { sortWallets } from '@/lib/wallets'
import { RemoveWalletDialog, RenameWalletDialog } from './WalletDialogs'
import { WALLET_MESSAGES, actionErrorMessage } from './validation'

const EMPTY_WALLETS_TITLE = 'Você ainda não adicionou uma carteira.'
/** Texto do Figma `9:1865`, para quem só tem a principal. */
const NO_SECONDARY_TITLE = 'Você ainda não adicionou uma carteira secundária.'

type DialogKind = 'rename' | 'remove'

interface WalletListProps {
  accountId: Id
  wallets: readonly Wallet[]
}

/**
 * Carteiras da conta (sem rádio: aqui a principal se escolhe pelo menu). Ações por card:
 * "Definir como principal" (só nas reservas), "Renomear" (diálogo), "Ver no Etherscan" (fora de
 * escopo) e "Remover" (confirmação). A ação em andamento deixa o card com `aria-busy`; o resultado
 * vai para o toast e para uma região `aria-live`.
 */
export function WalletList({ accountId, wallets }: WalletListProps) {
  const queryClient = useQueryClient()
  const listRef = useRef<HTMLDivElement>(null)
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

  const sorted = sortWallets(wallets)

  return (
    // Recebe o foco depois de uma remoção (o gatilho do menu sumiu junto com o card)
    <div
      ref={listRef}
      tabIndex={-1}
      role="group"
      aria-label="Suas carteiras"
      className="flex flex-col gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div aria-live="polite" className="sr-only">
        <p key={announcement.seq}>{announcement.message}</p>
      </div>
      {sorted.length === 0 ? (
        <EmptyState
          icon={<WalletIcon />}
          title={EMPTY_WALLETS_TITLE}
          description="Adicione o endereço de uma carteira para usá-la no Pagamento."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3" aria-label="Carteiras salvas">
            {sorted.map((wallet) => (
              <li key={wallet.id} data-wallet-id={wallet.id}>
                <WalletCard
                  wallet={wallet}
                  selectable={false}
                  busy={busy}
                  actions={actionsFor(wallet)}
                />
              </li>
            ))}
          </ul>
          {sorted.length === 1 && (
            <EmptyState
              icon={<WalletIcon />}
              title={NO_SECONDARY_TITLE}
              description="Uma carteira de reserva entra no lugar da principal quando ela for removida."
              className="py-6"
            />
          )}
        </>
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
        hasOthers={wallets.length > 1}
        removing={remove.isPending}
        onConfirm={() => target && remove.mutate(target)}
        onCloseAutoFocus={restoreFocus}
      />
    </div>
  )
}

/** Mesmas caixas da lista (dois cards de 83 px medidos no browser). */
export function WalletListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-[83px] w-full rounded-lg motion-reduce:animate-none" />
      ))}
    </div>
  )
}
