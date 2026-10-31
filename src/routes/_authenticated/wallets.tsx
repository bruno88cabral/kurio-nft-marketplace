import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { walletsQuery } from '@/api/wallets'
import { useSession } from '@/auth/useSession'
import { ErrorState } from '@/components/kurio'
import { AccountLayout } from '@/features/account/AccountLayout'
import { AccountPanel } from '@/features/account/AccountPanel'
import { WalletForm } from '@/features/account/WalletForm'
import { WalletList, WalletListSkeleton } from '@/features/account/WalletList'

export const Route = createFileRoute('/_authenticated/wallets')({
  head: () => ({ meta: [{ title: 'Carteiras · Kurio' }] }),
  component: WalletsPage,
})

function WalletsPage() {
  // `_authenticated` já confirmou a sessão; `account` só some durante o logout/expiração
  const { account } = useSession()
  const wallets = useQuery({ ...walletsQuery(account?.id ?? ''), enabled: account !== undefined })

  return (
    <AccountLayout active="wallets" title="Carteiras" description="Endereços que você usa para pagar e receber NFTs.">
      <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:items-start">
        <AccountPanel title="Suas carteiras">
          {wallets.data && account ? (
            <WalletList key={account.id} accountId={account.id} wallets={wallets.data} />
          ) : wallets.isError ? (
            <ErrorState
              title="Não foi possível carregar suas carteiras."
              onRetry={() => void wallets.refetch()}
              retrying={wallets.isFetching}
            />
          ) : (
            <WalletListSkeleton />
          )}
        </AccountPanel>
        {account && (
          <AccountPanel title="Adicionar carteira">
            <WalletForm key={account.id} accountId={account.id} />
          </AccountPanel>
        )}
      </div>
    </AccountLayout>
  )
}
