import { Link } from '@tanstack/react-router'
import { Wallet as WalletIcon } from 'lucide-react'
import { useState } from 'react'
import type { Id, Network, Wallet } from '@/contracts'
import { EmptyState, ErrorState, FormField } from '@/components/kurio'
import { buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { NETWORKS, networkLabel, walletRoleLabel } from '@/lib/wallets'
import { cn } from '@/lib/utils'
import type { CollectorForm as CollectorFormState } from './useCollectorForm'

const FIELD_CLASS = 'h-11'
export const COLLECTOR_HEADING_ID = 'checkout-perfil-do-colecionador'
export const ONLY_PRIMARY_MESSAGE = 'Você só tem a carteira principal.'
export const WALLET_LOCKED_MESSAGE = 'A carteira fica fixa até o pedido anterior ser resolvido.'

export interface CollectorFormProps {
  form: CollectorFormState
  /** Carteiras cadastradas em ordem (`sortWallets`); `undefined` enquanto carregam. */
  wallets: readonly Wallet[] | undefined
  walletsError: boolean
  walletsRetrying: boolean
  onRetryWallets: () => void
  selected: Wallet | undefined
  selectWallet: (walletId: Id) => void
  /** "Usar outra carteira?": a escolhida não é a principal. */
  useOther: boolean
  setUseOther: (on: boolean) => void
  /** Tentativa pendente: a carteira não muda (R4). */
  locked: boolean
}

const walletOptionLabel = (wallet: Wallet) =>
  `${walletRoleLabel(wallet.role)} · ${wallet.label} · ${networkLabel(wallet.network)}`

/**
 * "Perfil do colecionador" do Pagamento (Figma `Desktop/Pagamento.png`, MYK-1114 D1 a D6), em 2 colunas lidas
 * linha a linha. Os campos do colecionador são validados no cliente e não vão no pedido. Rede, Endereço e Tipo de
 * carteira derivam da carteira cadastrada escolhida (`useWalletConnection`): sem campo livre de endereço.
 */
export function CollectorForm({
  form,
  wallets,
  walletsError,
  walletsRetrying,
  onRetryWallets,
  selected,
  selectWallet,
  useOther,
  setUseOther,
  locked,
}: CollectorFormProps) {
  const { errors, field } = form
  // "Usar outra carteira?" marcado sem outra carteira cadastrada: a escolha não muda (fica a principal), mas o
  // rádio fica marcado para mostrar o porquê (D4). Estado só da tela
  const [wantOther, setWantOther] = useState(false)
  const others = wallets?.filter((w) => w.role !== 'primary') ?? []
  const checked = useOther || (wantOther && !locked)
  // Com "outra carteira", as opções são só as outras; senão os selects mostram a escolhida (a principal), travados
  const options = useOther ? others : (wallets ?? [])
  const networks = NETWORKS.filter((network) => options.some((w) => w.network === network))
  const walletEditable = useOther && !locked

  const selectNetwork = (network: Network) => {
    if (network === selected?.network) return
    const target = options.find((w) => w.network === network)
    if (target) selectWallet(target.id)
  }

  return (
    <section aria-labelledby={COLLECTOR_HEADING_ID} className="flex min-w-0 flex-col gap-4">
      <h2 id={COLLECTOR_HEADING_ID} className="text-body-lg font-medium">
        Perfil do colecionador
      </h2>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-4 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
        <FormField label="Nome de exibição" required error={errors.displayName}>
          {(control) => <Input {...control} {...field('displayName')} autoComplete="nickname" className={FIELD_CLASS} />}
        </FormField>
        <FormField label="Nome de usuário" required error={errors.username}>
          {(control) => (
            <Input
              {...control}
              {...field('username')}
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
              className={FIELD_CLASS}
            />
          )}
        </FormField>

        {selected && wallets ? (
          <FormField label="Rede" required disabled={!walletEditable}>
            {(control) => (
              <Select value={selected.network} onValueChange={(value) => selectNetwork(value as Network)} disabled={control.disabled}>
                <SelectTrigger {...control} className={cn(FIELD_CLASS, 'w-full')}>
                  <SelectValue placeholder="Selecione uma rede" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {(networks.includes(selected.network) ? networks : [selected.network, ...networks]).map((network) => (
                    <SelectItem key={network} value={network}>
                      {networkLabel(network)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
        ) : (
          <WalletsState wallets={wallets} isError={walletsError} retrying={walletsRetrying} onRetry={onRetryWallets} />
        )}

        <FormField label="Nome do perfil" required error={errors.profileName}>
          {(control) => <Input {...control} {...field('profileName')} autoComplete="off" className={FIELD_CLASS} />}
        </FormField>

        {selected && (
          <FormField label="Endereço da carteira" required>
            {(control) => (
              // Só leitura e com quebra: o endereço completo não cabe numa linha no mobile (D3)
              <Textarea
                {...control}
                readOnly
                rows={1}
                value={selected.address}
                className="min-h-11 resize-none font-mono break-all"
              />
            )}
          </FormField>
        )}

        <FormField label="ENS ou carteira secundária (opcional)" error={errors.altWallet}>
          {(control) => (
            <Input
              {...control}
              {...field('altWallet')}
              placeholder="nome.eth ou 0x…"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className={FIELD_CLASS}
            />
          )}
        </FormField>

        {selected && wallets && (
          <FormField label="Tipo de carteira" required disabled={!walletEditable}>
            {(control) => (
              <Select value={selected.id} onValueChange={selectWallet} disabled={control.disabled}>
                <SelectTrigger {...control} className={cn(FIELD_CLASS, 'w-full')}>
                  <SelectValue placeholder="Selecione uma carteira" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {(options.includes(selected) ? options : [selected, ...options]).map((wallet) => (
                    <SelectItem key={wallet.id} value={wallet.id}>
                      {walletOptionLabel(wallet)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
        )}

        <FormField label="Código de indicação" required error={errors.referralCode}>
          {(control) => (
            <Input
              {...control}
              {...field('referralCode')}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={cn(FIELD_CLASS, 'uppercase')}
            />
          )}
        </FormField>
        <FormField label="E-mail" required error={errors.email}>
          {(control) => <Input {...control} {...field('email')} type="email" autoComplete="email" className={FIELD_CLASS} />}
        </FormField>
        <FormField label="Nome ENS" required error={errors.ensName}>
          {(control) => (
            <div className="flex gap-2">
              <Input
                {...control}
                {...field('ensName')}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className={cn(FIELD_CLASS, 'min-w-0 flex-1')}
              />
              {/* O sufixo é fixo: o Figma o desenha como select, mas só existe ".eth" */}
              <Select value="eth" disabled={control.disabled}>
                <SelectTrigger aria-label="Sufixo ENS" className={cn(FIELD_CLASS, 'shrink-0')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="eth">.eth</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </FormField>
      </div>

      {wallets && wallets.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="checkout-usar-outra-carteira"
              checked={checked}
              disabled={locked}
              onCheckedChange={(value) => {
                const on = value === true
                setWantOther(on)
                setUseOther(on)
              }}
              // O Figma desenha um rádio solto; é um liga/desliga, então é checkbox com o visual redondo
              className="size-4.5 rounded-full"
            />
            <Label htmlFor="checkout-usar-outra-carteira" className="text-body font-normal">
              Usar outra carteira?
            </Label>
          </div>
          {locked ? (
            <p className="text-muted-foreground text-caption">{WALLET_LOCKED_MESSAGE}</p>
          ) : (
            checked &&
            others.length === 0 && (
              <p className="text-muted-foreground text-caption">
                {ONLY_PRIMARY_MESSAGE}{' '}
                <Link to="/wallets" className={cn(buttonVariants({ variant: 'link', size: 'sm' }), 'h-auto px-0')}>
                  Cadastrar outra carteira
                </Link>
              </p>
            )
          )}
        </div>
      )}

      <FormField label="Observação do colecionador (opcional)" error={errors.note} className="sm:w-1/2 sm:pr-4">
        {(control) => <Textarea {...control} {...field('note')} rows={6} className="min-h-40" />}
      </FormField>
    </section>
  )
}

/** No lugar de Rede, Endereço e Tipo enquanto as carteiras carregam, falham ou não existem (ocupa as 3 linhas). */
function WalletsState({
  wallets,
  isError,
  retrying,
  onRetry,
}: {
  wallets: readonly Wallet[] | undefined
  isError: boolean
  retrying: boolean
  onRetry: () => void
}) {
  const className = 'sm:row-span-3'
  if (isError && !wallets) {
    return <ErrorState title="Não foi possível carregar suas carteiras." retrying={retrying} onRetry={onRetry} className={cn('py-6', className)} />
  }
  if (!wallets) {
    return (
      <div aria-busy className={cn('flex flex-col gap-4', className)}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} aria-hidden className="h-16 rounded-md motion-reduce:animate-none" />
        ))}
        <p role="status" className="sr-only">
          Carregando as carteiras…
        </p>
      </div>
    )
  }
  // Carteiras existem mas nenhuma é a escolhida (a da tentativa pendente foi removida): nada a mostrar aqui
  if (wallets.length > 0) return null
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
      className={className}
    />
  )
}
