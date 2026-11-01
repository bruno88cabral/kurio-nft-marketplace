import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { walletsQuery } from '@/api/wallets'
import { useSession } from '@/auth/useSession'
import { ErrorState } from '@/components/kurio'
import { AccountLayout } from '@/features/account/AccountLayout'
import { WalletForm } from '@/features/account/WalletForm'
import { WalletList } from '@/features/account/WalletList'

export const Route = createFileRoute('/_authenticated/wallets')({
  head: () => ({ meta: [{ title: 'Carteiras · Kurio' }] }),
  component: WalletsPage,
})

function WalletsPage() {
  // `_authenticated` já confirmou a sessão; `account` só some durante o logout/expiração
  const { account } = useSession()
  const wallets = useQuery({ ...walletsQuery(account?.id ?? ''), enabled: account !== undefined })

  return (
    <AccountLayout active="wallets" title="Carteiras" hideTitle>
      {account && (
        <WalletList
          key={account.id}
          accountId={account.id}
          wallets={wallets.data}
          error={
            wallets.isError && !wallets.data ? (
              <ErrorState
                title="Não foi possível carregar suas carteiras."
                onRetry={() => void wallets.refetch()}
                retrying={wallets.isFetching}
              />
            ) : undefined
          }
          form={<WalletForm accountId={account.id} />}
        />
      )}
    </AccountLayout>
  )
}
