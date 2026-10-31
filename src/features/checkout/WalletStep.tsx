import { Link } from '@tanstack/react-router'
import { CircleAlert, CircleCheck, LoaderCircle, Wallet as WalletIcon } from 'lucide-react'
import type { Id, Wallet } from '@/contracts'
import { EmptyState, ErrorState, WalletCard, WalletCardGroup } from '@/components/kurio'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export type WalletConnection =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'connected' }
  | { status: 'rejected'; message: string }

export interface WalletStepProps {
  wallets: readonly Wallet[] | undefined
  isError: boolean
  retrying: boolean
  onRetry: () => void
  selectedId: Id | undefined
  onSelect: (walletId: Id) => void
  connection: WalletConnection
  onConnect: () => void
  /** Envio sem resposta final: a carteira não pode mudar (o pedido pode existir com a escolhida). */
  locked: boolean
}

/**
 * Etapa "Carteira": as carteiras cadastradas (`WalletCard selectable`, a principal pré-selecionada) e a
 * conexão com a escolhida (`POST /wallets/:id/connect`). Trocar a seleção desconecta.
 */
export function WalletStep({
  wallets,
  isError,
  retrying,
  onRetry,
  selectedId,
  onSelect,
  connection,
  onConnect,
  locked,
}: WalletStepProps) {
  if (isError && !wallets) {
    return (
      <ErrorState
        title="Não foi possível carregar suas carteiras."
        retrying={retrying}
        onRetry={onRetry}
        className="py-6"
      />
    )
  }
  if (!wallets) {
    return (
      <div aria-busy className="flex flex-col gap-3">
        <Skeleton aria-hidden className="h-20 rounded-lg motion-reduce:animate-none" />
        <p role="status" className="sr-only">
          Carregando as carteiras…
        </p>
      </div>
    )
  }
  if (wallets.length === 0) {
    return (
      <EmptyState
        icon={<WalletIcon />}
        title="Você ainda não tem uma carteira cadastrada."
        description="Cadastre uma carteira para pagar."
        action={
          <Link to="/wallets" className={buttonVariants({ variant: 'default' })}>
            Cadastrar carteira
          </Link>
        }
      />
    )
  }

  const selected = wallets.find((w) => w.id === selectedId)
  return (
    <div className="flex flex-col gap-3">
      <WalletCardGroup value={selectedId} onValueChange={onSelect} label="Carteira de pagamento" disabled={locked}>
        {wallets.map((wallet) => (
          <WalletCard key={wallet.id} wallet={wallet} />
        ))}
      </WalletCardGroup>
      {locked && (
        <p className="text-muted-foreground text-caption">
          A carteira fica fixa até sabermos se o envio anterior foi recebido.
        </p>
      )}
      {selected && (
        <div className="flex flex-wrap items-center gap-3" aria-live="polite">
          <ConnectionStatus connection={connection} label={selected.label} />
          {connection.status !== 'connected' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-busy={connection.status === 'connecting' || undefined}
              aria-disabled={connection.status === 'connecting' || undefined}
              onClick={() => connection.status !== 'connecting' && onConnect()}
            >
              {connection.status === 'connecting' && (
                <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
              )}
              {connection.status === 'rejected' ? 'Tentar novamente' : 'Conectar'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function ConnectionStatus({ connection, label }: { connection: WalletConnection; label: string }) {
  switch (connection.status) {
    case 'connected':
      return (
        <p className="text-text-accent text-caption inline-flex items-center gap-1.5">
          <CircleCheck aria-hidden className="size-4" />
          {label} conectada.
        </p>
      )
    case 'connecting':
      return <p className="text-muted-foreground text-caption">Conectando {label}… Aprove no app da carteira.</p>
    case 'rejected':
      return (
        <p role="alert" className="text-destructive text-caption inline-flex items-start gap-1.5">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {connection.message}
        </p>
      )
    default:
      return <p className="text-muted-foreground text-caption">Conecte a carteira para confirmar a compra.</p>
  }
}
