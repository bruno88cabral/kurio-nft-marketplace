import type { RefObject } from 'react'
import type { Wallet } from '@/contracts'
import { PriceSummary, type PriceSummaryValues } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { networkLabel, shortAddress, walletProviderLabel, walletRoleLabel, type WalletProvider } from '@/lib/wallets'
import type { CollectorValues } from './collectorForm'
import { ReviewStep, type ReviewLine } from './ReviewStep'

export const REVIEW_DIALOG_TITLE = 'Revise seu pedido'

export interface ReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "Confirmar compra" do diálogo: quem chama fecha o diálogo e segue o envio de sempre (R3 → R4). */
  onConfirm: () => void
  collector: CollectorValues
  wallet: Wallet
  provider: WalletProvider | undefined
  lines: readonly ReviewLine[]
  /** Os valores da cotação na tela (nada é somado aqui). */
  quote: PriceSummaryValues | undefined
  /** Para onde o foco volta ao fechar: o "Confirmar compra" da página (o clique nem sempre o focou, ex.: Safari). */
  returnFocusTo: RefObject<HTMLElement | null>
}

/**
 * Revisão antes do envio (MYK-1114 D8): os dados do colecionador, a carteira, o provedor, os itens e o total da
 * cotação exibida. Não chama a API: "Voltar e editar" só fecha (o foco volta ao "Confirmar compra" da página) e
 * "Confirmar compra" devolve a decisão a quem abriu.
 */
export function ReviewDialog({
  open,
  onOpenChange,
  onConfirm,
  collector,
  wallet,
  provider,
  lines,
  quote,
  returnFocusTo,
}: ReviewDialogProps) {
  const rows: [string, string][] = [
    ['Nome de exibição', collector.displayName.trim()],
    ['Nome de usuário', collector.username.trim()],
    ['Nome do perfil', collector.profileName.trim()],
    ['E-mail', collector.email.trim()],
    ['Código de indicação', collector.referralCode.trim().toUpperCase()],
    ['Nome ENS', `${collector.ensName.trim().toLowerCase()}.eth`],
  ]
  if (collector.altWallet.trim()) rows.push(['ENS ou carteira secundária', collector.altWallet.trim()])
  if (collector.note.trim()) rows.push(['Observação', collector.note.trim()])
  const walletRows: [string, string][] = [
    ['Carteira', `${walletRoleLabel(wallet.role)} · ${wallet.label}`],
    ['Rede', networkLabel(wallet.network)],
    ['Endereço', shortAddress(wallet.address)],
  ]
  if (provider) walletRows.push(['Provedor', walletProviderLabel(provider)])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocusTo.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-heading">{REVIEW_DIALOG_TITLE}</DialogTitle>
          <DialogDescription>Confira os dados antes de confirmar. Nada é enviado até você confirmar.</DialogDescription>
        </DialogHeader>
        <ReviewList title="Colecionador" rows={rows} />
        <ReviewList title="Carteira e rede" rows={walletRows} />
        <section aria-label="Seus NFTs" className="flex flex-col gap-3">
          <h3 className="text-body font-medium">Seus NFTs</h3>
          <ReviewStep lines={lines} />
        </section>
        <PriceSummary quote={quote} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" size="lg">
              Voltar e editar
            </Button>
          </DialogClose>
          <Button type="button" size="lg" onClick={onConfirm}>
            Confirmar compra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReviewList({ title, rows }: { title: string; rows: readonly [string, string][] }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-body font-medium">{title}</h3>
      <dl className="text-caption grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="break-words whitespace-pre-line">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
