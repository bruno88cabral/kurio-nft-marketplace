import { EllipsisVertical } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import type { Id, Wallet } from '@/contracts'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { networkLabel, shortAddress, walletRoleLabel } from '@/lib/wallets'
import { cn } from '@/lib/utils'
import { OUT_OF_SCOPE_LABEL } from './OutOfScopeAction'

export interface WalletCardGroupProps {
  /** `Wallet.id` selecionado. */
  value: Id | undefined
  onValueChange: (walletId: Id) => void
  /** Nome acessível do grupo (padrão "Carteiras salvas"). */
  label?: string
  children: ReactNode
  className?: string
}

/** Grupo de rádio das carteiras salvas; os filhos são `WalletCard`. */
export function WalletCardGroup({
  value,
  onValueChange,
  label = 'Carteiras salvas',
  children,
  className,
}: WalletCardGroupProps) {
  return (
    <RadioGroup aria-label={label} value={value ?? ''} onValueChange={onValueChange} className={cn('gap-3', className)}>
      {children}
    </RadioGroup>
  )
}

export interface WalletCardAction {
  label: string
  onSelect?: () => void
  /** Ação destrutiva (ex.: "Desconectar"): texto em vermelho. */
  destructive?: boolean
  /** Fora de escopo: item desabilitado com "Em breve" (padrão `OutOfScopeAction` dentro do menu). */
  outOfScope?: boolean
}

export interface WalletCardProps {
  wallet: Wallet
  /** Nome ENS, exibido no lugar do endereço curto quando existir. */
  ens?: string
  /** Itens do menu de ações (Figma `16:990`). Sem itens, o menu não aparece. */
  actions?: WalletCardAction[]
  /**
   * `true` (padrão): rádio de seleção, dentro de `WalletCardGroup` (Pagamento). `false`: só exibe
   * (tela Carteiras, onde escolher a principal é uma ação do menu), sem rádio nem grupo.
   */
  selectable?: boolean
  /**
   * Ação em andamento sobre esta carteira: `aria-busy` no card e itens do menu desabilitados. O
   * gatilho continua habilitado para não perder o foco, que volta para ele quando o menu fecha.
   */
  busy?: boolean
  className?: string
}

/**
 * Carteira salva (Figma mobile `70398:242`/`243`): apelido, papel (Principal/Reserva), endereço
 * ou ENS, rede, rádio de seleção e menu de ações. Selecionável, precisa estar dentro de `WalletCardGroup`.
 * O menu fica fora do `<label>` para não aninhar interativos.
 */
export function WalletCard({ wallet, ens, actions = [], selectable = true, busy = false, className }: WalletCardProps) {
  const id = useId()
  const Info = selectable ? 'label' : 'div'

  return (
    <div
      data-slot="wallet-card"
      aria-busy={busy || undefined}
      className={cn(
        'border-border bg-card has-data-[state=checked]:border-primary has-[button[role=radio]:focus-visible]:ring-ring/50 relative flex items-center gap-3 rounded-lg border p-3 has-[button[role=radio]:focus-visible]:ring-3',
        className,
      )}
    >
      {selectable && <RadioGroupItem id={id} value={wallet.id} className="size-5" />}
      <Info
        htmlFor={selectable ? id : undefined}
        className={cn('flex min-w-0 flex-1 flex-col gap-0.5', selectable && 'cursor-pointer')}
      >
        <span className="flex items-center gap-2">
          <span className="text-body truncate font-medium">{wallet.label}</span>
          <span
            className={cn(
              'rounded-sm border px-1.5 text-tiny font-bold uppercase',
              wallet.role === 'primary' ? 'border-primary text-text-accent' : 'border-border-soft text-muted-foreground',
            )}
          >
            {walletRoleLabel(wallet.role)}
          </span>
        </span>
        <span className="text-muted-foreground text-caption truncate" title={wallet.address}>
          {ens ?? shortAddress(wallet.address)}
          <span className="sr-only">, endereço {wallet.address}</span>
        </span>
        <span className="text-muted-foreground text-tiny">{networkLabel(wallet.network)}</span>
      </Info>
      {actions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Ações da carteira ${wallet.label}`}>
              <EllipsisVertical aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            {actions.map((action) => (
              <DropdownMenuItem
                key={action.label}
                variant={action.destructive ? 'destructive' : 'default'}
                disabled={action.outOfScope || busy}
                onSelect={action.onSelect}
              >
                {action.label}
                {action.outOfScope && (
                  <span className="text-muted-foreground ml-auto text-tiny">{OUT_OF_SCOPE_LABEL}</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
