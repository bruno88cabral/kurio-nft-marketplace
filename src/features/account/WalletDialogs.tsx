import { useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { invalidateWallets, updateWallet } from '@/api/wallets'
import { SESSION_EXPIRED_MESSAGE } from '@/auth/sessionLifecycle'
import type { Id, Wallet } from '@/contracts'
import { FormField } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { networkLabel, shortAddress } from '@/lib/wallets'
import { FormAlert } from './AuthDialog'
import { useAccountForm } from './useAccountForm'
import { MAX_WALLET_LABEL, WALLET_MESSAGES, validateRenameWallet, type WalletLabelValues } from './validation'

const FIELDS = ['label'] as const satisfies readonly (keyof WalletLabelValues)[]

interface WalletDialogProps {
  /** Carteira alvo; continua definida enquanto o diálogo anima o fechamento. */
  wallet: Wallet | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Para onde o foco vai ao fechar (o item do menu que abriu o diálogo já foi desmontado). */
  onCloseAutoFocus?: (event: Event) => void
}

function walletSummary(wallet: Wallet) {
  return `${shortAddress(wallet.address)} · ${networkLabel(wallet.network)}`
}

interface RenameWalletDialogProps extends WalletDialogProps {
  accountId: Id
  /** Anuncia o resultado na região `aria-live` da lista. */
  onRenamed: (message: string) => void
}

/**
 * "Renomear": diálogo pequeno (foco preso, Esc fecha) com o apelido atual selecionado. Apelido
 * vazio ou com mais de 40 dá erro sem request; os 422 do servidor voltam no campo.
 */
export function RenameWalletDialog({
  wallet,
  open,
  onOpenChange,
  onCloseAutoFocus,
  accountId,
  onRenamed,
}: RenameWalletDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        {wallet && (
          // `key`: abrir para outra carteira recomeça o formulário com o apelido dela
          <RenameWalletForm
            key={wallet.id}
            wallet={wallet}
            accountId={accountId}
            onDone={(message) => {
              onOpenChange(false)
              onRenamed(message)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RenameWalletForm({
  wallet,
  accountId,
  onDone,
}: {
  wallet: Wallet
  accountId: Id
  onDone: (message: string) => void
}) {
  const queryClient = useQueryClient()
  const form = useAccountForm({
    fields: FIELDS,
    initial: { label: wallet.label },
    validate: validateRenameWallet,
    request: ({ label }: WalletLabelValues) => updateWallet(wallet.id, { label: label.trim() }),
    onSuccess: async () => {
      await invalidateWallets(queryClient, accountId)
      toast.success(WALLET_MESSAGES.renamed)
      onDone(WALLET_MESSAGES.renamed)
    },
    unauthorizedMessage: SESSION_EXPIRED_MESSAGE,
  })
  const length = form.values.label.trim().length

  return (
    <form noValidate onSubmit={form.onSubmit} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>Renomear carteira</DialogTitle>
        <DialogDescription>{walletSummary(wallet)}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <FormAlert message={form.formError} />
        <FormField
          label="Apelido"
          required
          description={`${length} de ${MAX_WALLET_LABEL} caracteres`}
          error={form.errors.label}
          apiError={form.apiErrors.label}
        >
          {(control) => (
            <Input
              {...control}
              {...form.field('label')}
              autoComplete="off"
              onFocus={(event) => event.currentTarget.select()}
              className="h-11"
            />
          )}
        </FormField>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" className="h-11">
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" className="h-11" disabled={form.submitting} aria-busy={form.submitting || undefined}>
          {form.submitting && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
          {form.submitting ? 'Salvando…' : 'Salvar'}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface RemoveWalletDialogProps extends WalletDialogProps {
  /** Há outra carteira para assumir como principal (muda o texto). */
  hasOthers: boolean
  removing: boolean
  onConfirm: () => void
}

/** Confirmação da remoção: foco preso, começa em "Cancelar" (a ação destrutiva nunca é o padrão). */
export function RemoveWalletDialog({
  wallet,
  open,
  onOpenChange,
  hasOthers,
  removing,
  onConfirm,
  onCloseAutoFocus,
}: RemoveWalletDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !removing && onOpenChange(next)}>
      <DialogContent showCloseButton={false} onCloseAutoFocus={onCloseAutoFocus}>
        {wallet && (
          <>
            <DialogHeader>
              <DialogTitle>Remover a carteira {wallet.label}?</DialogTitle>
              <DialogDescription>
                {walletSummary(wallet)}. Ela deixa de aparecer no Pagamento.
                {wallet.role === 'primary' && hasOthers && ' Outra carteira passa a ser a principal.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="h-11" disabled={removing}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                type="button"
                variant="destructive"
                className="h-11"
                onClick={onConfirm}
                disabled={removing}
                aria-busy={removing || undefined}
              >
                {removing && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
                {removing ? 'Removendo…' : 'Remover'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
