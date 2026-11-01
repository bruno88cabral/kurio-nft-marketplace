import { CircleAlert, LoaderCircle, Unplug } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { walletProviderLabel, type WalletProvider } from '@/lib/wallets'
import { cn } from '@/lib/utils'

export type WalletOptionStatus = 'idle' | 'connecting' | 'rejected' | 'disconnected'

export interface WalletOptionGroupProps {
  value: WalletProvider | undefined
  onValueChange: (provider: WalletProvider) => void
  /** Nome acessível do grupo (padrão "Carteira"). Ignorado com `labelledBy`. */
  label?: string
  /** Id de um título visível que nomeia o grupo (`aria-labelledby`), no lugar de `label`. */
  labelledBy?: string
  disabled?: boolean
  children: ReactNode
  className?: string
}

/** Grupo de rádio dos provedores. Os filhos são `WalletOption`. */
export function WalletOptionGroup({
  value,
  onValueChange,
  label = 'Carteira',
  labelledBy,
  disabled,
  children,
  className,
}: WalletOptionGroupProps) {
  return (
    <RadioGroup
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      value={value ?? ''}
      onValueChange={(v) => onValueChange(v as WalletProvider)}
      disabled={disabled}
      className={cn('gap-2', className)}
    >
      {children}
    </RadioGroup>
  )
}

export interface WalletOptionProps {
  provider: WalletProvider
  /** Estado da conexão com o provedor (seleção vem do `WalletOptionGroup`). */
  status?: WalletOptionStatus
  /** Mensagem do estado `rejected` (padrão "Conexão recusada pela carteira."). */
  rejectedMessage?: string
  disabled?: boolean
  className?: string
}

const STATUS_TEXT: Record<Exclude<WalletOptionStatus, 'idle'>, string> = {
  connecting: 'Conectando…',
  rejected: 'Conexão recusada pela carteira.',
  disconnected: 'Desconectada',
}

/**
 * Linha de provedor (Figma mobile `70398:245..247`): nome, estado e rádio à direita. Sem logo nem monograma
 * (decisão do humano: os logos não foram exportados, e a linha fica só com o nome, como no Figma).
 * A linha inteira é o `<label>` do rádio. Precisa estar dentro de `WalletOptionGroup`.
 */
export function WalletOption({ provider, status = 'idle', rejectedMessage, disabled, className }: WalletOptionProps) {
  const id = `${useId()}-${provider}`
  const nameId = `${id}-name`
  const statusId = `${id}-status`
  const text = status === 'rejected' ? (rejectedMessage ?? STATUS_TEXT.rejected) : status !== 'idle' ? STATUS_TEXT[status] : undefined

  return (
    <label
      htmlFor={id}
      data-slot="wallet-option"
      data-status={status}
      className={cn(
        'border-border bg-card hover:bg-muted flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
        'has-data-[state=checked]:border-primary has-focus-visible:ring-ring/50 has-focus-visible:ring-3',
        status === 'rejected' && 'border-destructive/60',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span id={nameId} className="text-body font-medium">
          {walletProviderLabel(provider)}
        </span>
        {text && (
          <span
            id={statusId}
            className={cn(
              'text-caption inline-flex items-center gap-1',
              status === 'rejected' ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {status === 'connecting' && <LoaderCircle aria-hidden className="size-3 animate-spin motion-reduce:animate-none" />}
            {status === 'rejected' && <CircleAlert aria-hidden className="size-3" />}
            {status === 'disconnected' && <Unplug aria-hidden className="size-3" />}
            {text}
          </span>
        )}
      </span>
      <RadioGroupItem
        id={id}
        value={provider}
        disabled={disabled}
        // O nome é só o do provedor; o estado vem uma vez, como descrição (o <label> envolve os dois)
        aria-labelledby={nameId}
        aria-describedby={text ? statusId : undefined}
        className="size-5"
      />
    </label>
  )
}
