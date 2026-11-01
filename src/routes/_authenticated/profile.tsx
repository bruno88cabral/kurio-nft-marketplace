import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { profileQuery } from '@/api/profile'
import { useSession } from '@/auth/useSession'
import { ErrorState } from '@/components/kurio'
import { AccountLayout } from '@/features/account/AccountLayout'
import { AccountPanel } from '@/features/account/AccountPanel'
import { PasswordForm } from '@/features/account/PasswordForm'
import { ProfileForm, ProfileFormSkeleton } from '@/features/account/ProfileForm'

export const Route = createFileRoute('/_authenticated/profile')({
  head: () => ({ meta: [{ title: 'Perfil · Kurio' }] }),
  component: ProfilePage,
})

function ProfilePage() {
  // `_authenticated` já confirmou a sessão; `account` só some durante o logout/expiração
  const { account } = useSession()
  const profile = useQuery({ ...profileQuery(account?.id ?? ''), enabled: account !== undefined })

  return (
    <AccountLayout active="profile" title="Perfil" description="Seus dados e a senha da conta.">
      <AccountPanel title="Dados do perfil">
        {profile.data && account ? (
          <ProfileForm key={profile.data.accountId} profile={profile.data} email={account.email} />
        ) : profile.isError ? (
          <ErrorState
            title="Não foi possível carregar seu perfil."
            onRetry={() => void profile.refetch()}
            retrying={profile.isFetching}
          />
        ) : (
          <ProfileFormSkeleton />
        )}
      </AccountPanel>
      {account && (
        <AccountPanel title="Alterar senha">
          <PasswordForm key={account.id} email={account.email} />
        </AccountPanel>
      )}
    </AccountLayout>
  )
}
