import { CircleCheck, LoaderCircle } from 'lucide-react'
import { useId, useRef } from 'react'
import { flushSync } from 'react-dom'
import type { Wallet } from '@/contracts'
import { WalletOption, WalletOptionGroup, type WalletOptionStatus } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { WALLET_PROVIDERS, walletProviderLabel, type WalletProvider } from '@/lib/wallets'

export type WalletConnection =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'connected' }
  | { status: 'rejected'; message: string }
  /** Só depois de um "Desconectar" explícito (em memória). */
  | { status: 'disconnected' }

export interface WalletStepProps {
  /** A carteira cadastrada escolhida no "Perfil do colecionador"; `undefined` enquanto carregam ou sem carteira. */
  selected: Wallet | undefined
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
 * "Carteira e rede" (no resumo do Pagamento): o provedor (`WalletOption`) com que a conexão da carteira escolhida
 * é simulada (`POST /wallets/:id/connect`), mais Conectar / Desconectar. A carteira cadastrada (e a rede dela) é
 * escolhida no formulário (`CollectorForm`). Trocar a carteira ou o provedor desconecta.
 */
export function WalletStep({ selected, connection, provider, onSelectProvider, onConnect, onDisconnect, locked }: WalletStepProps) {
  const headingId = useId()
  const connectRef = useRef<HTMLButtonElement>(null)

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-body-lg font-medium lg:text-center">
        Carteira e rede
      </h2>
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
    </section>
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
      // Sem conexão o motivo fica só junto ao "Confirmar compra" ("Conecte uma carteira para confirmar.", ligado a
      // ele por `aria-describedby`); repeti-lo aqui duplicaria o texto. O "Desconectada" está no `WalletOption`
      return null
  }
}
