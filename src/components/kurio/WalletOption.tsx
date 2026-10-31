import { CircleAlert, LoaderCircle, Unplug } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { walletProviderLabel, type WalletProvider } from '@/lib/wallets'
import { cn } from '@/lib/utils'

export type WalletOptionStatus = 'idle' | 'connecting' | 'rejected' | 'disconnected'

export interface WalletOptionGroupProps {
  value: WalletProvider | undefined
  onValueChange: (provider: WalletProvider) => void
  /** Nome acessível do grupo (padrão "Carteira"). */
  label?: string
  disabled?: boolean
  children: ReactNode
  className?: string
}

/** Grupo de rádio dos provedores. Os filhos são `WalletOption`. */
export function WalletOptionGroup({
  value,
  onValueChange,
  label = 'Carteira',
  disabled,
  children,
  className,
}: WalletOptionGroupProps) {
  return (
    <RadioGroup
      aria-label={label}
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

/** Monograma colorido no lugar do logo (logos oficiais não foram exportados; ver ARCHITECTURE.md). */
const MONOGRAM: Record<WalletProvider, { letter: string; className: string }> = {
  metamask: { letter: 'M', className: 'bg-[#F6851B] text-[#140D0A]' },
  walletconnect: { letter: 'W', className: 'bg-[#3B99FC] text-[#140D0A]' },
  coinbase: { letter: 'C', className: 'bg-[#0052FF] text-[#F7F3EC]' },
}

/**
 * Linha de provedor (Figma mobile `70398:245..247`): ícone 40px, nome, estado e rádio à direita.
 * A linha inteira é o `<label>` do rádio. Precisa estar dentro de `WalletOptionGroup`.
 */
export function WalletOption({ provider, status = 'idle', rejectedMessage, disabled, className }: WalletOptionProps) {
  const id = `${useId()}-${provider}`
  const statusId = `${id}-status`
  const monogram = MONOGRAM[provider]
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
      <span
        aria-hidden
        className={cn('flex size-10 shrink-0 items-center justify-center rounded-full text-body-lg font-bold', monogram.className)}
      >
        {monogram.letter}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body font-medium">{walletProviderLabel(provider)}</span>
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
        aria-describedby={text ? statusId : undefined}
        className="size-5"
      />
    </label>
  )
}
