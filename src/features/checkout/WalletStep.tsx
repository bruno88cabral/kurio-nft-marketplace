import { Link } from '@tanstack/react-router'
import { CircleCheck, LoaderCircle, Wallet as WalletIcon } from 'lucide-react'
import { useId, useRef } from 'react'
import { flushSync } from 'react-dom'
import type { Id, Wallet } from '@/contracts'
import {
  EmptyState,
  ErrorState,
  WalletCard,
  WalletCardGroup,
  WalletOption,
  WalletOptionGroup,
  type WalletOptionStatus,
} from '@/components/kurio'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { WALLET_PROVIDERS, walletProviderLabel, type WalletProvider } from '@/lib/wallets'

export type WalletConnection =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'connected' }
  | { status: 'rejected'; message: string }
  /** Só depois de um "Desconectar" explícito (em memória). */
  | { status: 'disconnected' }

export interface WalletStepProps {
  wallets: readonly Wallet[] | undefined
  isError: boolean
  retrying: boolean
  onRetry: () => void
  selectedId: Id | undefined
  onSelect: (walletId: Id) => void
  connection: WalletConnection
  /** O provedor da conexão simulada (`draft.provider`). */
  provider: WalletProvider | undefined
  /** Trocar de provedor desconecta. */
  onSelectProvider: (provider: WalletProvider) => void
  onConnect: () => void
  /** Só no cliente: tira a conexão do rascunho. */
  onDisconnect: () => void
  /**
   * Envio sem resposta final: a carteira não pode mudar (o pedido pode existir com a escolhida). Sem conexão, o
   * "Conectar" e o status somem: "Tentar de novo" reenvia o mesmo pedido sem precisar dela.
   */
  locked: boolean
}

/**
 * Etapa "Carteira": as carteiras cadastradas (`WalletCard selectable`, a principal pré-selecionada) e, em
 * "Carteira e rede", o provedor (`WalletOption`) com que a conexão da escolhida é simulada
 * (`POST /wallets/:id/connect`), mais Conectar / Desconectar. Trocar a carteira ou o provedor desconecta.
 */
export function WalletStep({
  wallets,
  isError,
  retrying,
  onRetry,
  selectedId,
  onSelect,
  connection,
  provider,
  onSelectProvider,
  onConnect,
  onDisconnect,
  locked,
}: WalletStepProps) {
  const headingId = useId()
  const connectRef = useRef<HTMLButtonElement>(null)
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
          A carteira fica fixa até o pedido anterior ser resolvido.
        </p>
      )}
      <h3 id={headingId} className="text-body font-medium">
        Carteira e rede
      </h3>
      <WalletOptionGroup value={provider} onValueChange={onSelectProvider} labelledBy={headingId} disabled={locked}>
        {WALLET_PROVIDERS.map((option) => (
          <WalletOption
            key={option}
            provider={option}
            status={option === provider ? optionStatus(connection) : 'idle'}
            rejectedMessage={connection.status === 'rejected' ? connection.message : undefined}
            disabled={locked}
          />
        ))}
      </WalletOptionGroup>
      {/* Travada (tentativa pendente): o reenvio não exige conexão, então não há "Conectar" nem "Desconectar" */}
      {selected && !(locked && connection.status !== 'connected') && (
        <div className="flex flex-wrap items-center gap-3" aria-live="polite">
          {!provider ? (
            <p className="text-muted-foreground text-caption">Escolha como conectar.</p>
          ) : (
            <ConnectionStatus connection={connection} label={selected.label} provider={walletProviderLabel(provider)} />
          )}
          {provider && connection.status !== 'connected' && (
            <Button
              ref={connectRef}
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
              {connection.status === 'rejected' ? 'Tentar novamente' : `Conectar com ${walletProviderLabel(provider)}`}
            </Button>
          )}
          {connection.status === 'connected' && !locked && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                // O "Conectar" toma o lugar do "Desconectar": o foco vai para ele, não para o <body>
                flushSync(onDisconnect)
                // "Conectada" exige provedor (`useWalletConnection`), então o "Conectar com …" sempre volta
                connectRef.current?.focus()
              }}
            >
              Desconectar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** O estado da conexão no `WalletOption` do provedor escolhido (conectada não tem estado próprio nele). */
function optionStatus(connection: WalletConnection): WalletOptionStatus {
  return connection.status === 'connected' ? 'idle' : connection.status
}

function ConnectionStatus({ connection, label, provider }: { connection: WalletConnection; label: string; provider: string }) {
  switch (connection.status) {
    case 'connected':
      return (
        <p className="text-text-accent text-caption inline-flex items-center gap-1.5">
          <CircleCheck aria-hidden className="size-4" />
          {label} conectada com {provider}.
        </p>
      )
    case 'connecting':
      return (
        <p className="text-muted-foreground text-caption">
          Conectando {label} com {provider}… Aprove no app da carteira.
        </p>
      )
    case 'rejected':
      // A mensagem aparece no `WalletOption` do provedor; aqui ela só é anunciada
      return (
        <p role="alert" className="sr-only">
          {connection.message}
        </p>
      )
    default:
      return <p className="text-muted-foreground text-caption">Conecte a carteira para confirmar a compra.</p>
  }
}
