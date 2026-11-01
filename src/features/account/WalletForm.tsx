import { useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createWallet, invalidateWallets } from '@/api/wallets'
import { SESSION_EXPIRED_MESSAGE } from '@/auth/sessionLifecycle'
import type { Id } from '@/contracts'
import { FormField } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NETWORKS, networkLabel } from '@/lib/wallets'
import { ACCOUNT_LABEL_CLASS } from './AccountLayout'
import { FormAlert } from './AuthDialog'
import { useAccountForm } from './useAccountForm'
import {
  MAX_WALLET_LABEL,
  WALLET_MESSAGES,
  isNetwork,
  validateWallet,
  type WalletValues,
} from './validation'

// Ordem visual do Figma, lida linha a linha: Rede | Apelido, Endereço
const FIELDS = ['network', 'label', 'address'] as const satisfies readonly (keyof WalletValues)[]
const EMPTY: WalletValues = { address: '', network: '', label: '' }
const FIELD_CLASS = 'h-11'

/**
 * Nova carteira (Figma `Desktop/Carteiras.png`, MYK-1102): grade de 2 colunas sem card, lida linha a linha
 * (Rede | Apelido da carteira, Endereço da carteira) e "Salvar carteira" laranja. Endereço em mono, sem
 * corretor; apelido opcional. Valida no cliente (sem request se houver erro); o 409 "Esta carteira já está
 * conectada." cai no endereço e os 422 nos campos. Sucesso limpa o formulário, atualiza lista e perfil e
 * avisa "Carteira adicionada.". A primeira carteira vira a principal; as seguintes, secundárias (mock).
 */
export function WalletForm({ accountId }: { accountId: Id }) {
  const queryClient = useQueryClient()
  const form = useAccountForm({
    fields: FIELDS,
    initial: EMPTY,
    validate: validateWallet,
    request: ({ address, network, label }: WalletValues) => {
      // `validateWallet` já garantiu a rede; o apelido vazio não vai (o mock recusa `''`)
      if (!isNetwork(network)) throw new Error('Rede inválida.')
      return createWallet({ address: address.trim(), network, label: label.trim() || undefined })
    },
    onSuccess: async () => {
      await invalidateWallets(queryClient, accountId)
      form.reset(EMPTY)
      toast.success(WALLET_MESSAGES.added)
    },
    unauthorizedMessage: SESSION_EXPIRED_MESSAGE,
    conflictField: 'address',
  })
  const network = form.field('network')
  const labelLength = form.values.label.trim().length

  return (
    <form noValidate aria-label="Nova carteira" onSubmit={form.onSubmit} className="flex flex-col gap-6">
      <FormAlert message={form.formError} />
      <div className="grid grid-cols-1 gap-x-7 gap-y-6 md:grid-cols-2">
        <FormField label="Rede" labelClassName={ACCOUNT_LABEL_CLASS} required error={form.errors.network} apiError={form.apiErrors.network}>
          {(control) => (
            <Select
              name={network.name}
              value={network.value}
              onValueChange={(value) => network.onChange({ target: { value } })}
              disabled={control.disabled}
            >
              <SelectTrigger {...control} ref={network.ref} className={`${FIELD_CLASS} w-full data-[size=default]:h-11`}>
                <SelectValue placeholder="Selecione uma rede" />
              </SelectTrigger>
              <SelectContent position="popper">
                {NETWORKS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {networkLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField
          label="Apelido da carteira (opcional)" labelClassName={ACCOUNT_LABEL_CLASS}
          description={`${labelLength} de ${MAX_WALLET_LABEL} caracteres. Sem apelido, ela vira "Carteira N".`}
          error={form.errors.label}
          apiError={form.apiErrors.label}
        >
          {(control) => <Input {...control} {...form.field('label')} autoComplete="off" className={FIELD_CLASS} />}
        </FormField>
        <FormField
          label="Endereço da carteira" labelClassName={ACCOUNT_LABEL_CLASS}
          required
          description="0x seguido de 40 caracteres hexadecimais (0–9, a–f)."
          error={form.errors.address}
          apiError={form.apiErrors.address}
        >
          {(control) => (
            <Input
              {...control}
              {...form.field('address')}
              placeholder="Endereço 0x da carteira"
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              className={`${FIELD_CLASS} font-mono`}
            />
          )}
        </FormField>
      </div>
      <div>
        <Button
          type="submit"
          size="lg"
          className="h-11 w-full px-6 font-bold sm:w-auto"
          disabled={form.submitting}
          aria-busy={form.submitting || undefined}
        >
          {form.submitting && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
          {form.submitting ? 'Salvando…' : 'Salvar carteira'}
        </Button>
      </div>
    </form>
  )
}
