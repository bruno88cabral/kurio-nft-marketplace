import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { PRIVATE_QUERY_ROOTS } from '@/auth/sessionLifecycle'
import { profileKeys } from './profile'
import { invalidateWallets, walletKeys, walletsQuery } from './wallets'

describe('walletKeys', () => {
  it('isoladas por conta e sob uma raiz privada', () => {
    expect(walletKeys.list('acc-1')).toEqual(['wallets', 'acc-1'])
    expect(walletsQuery('acc-1').queryKey).toEqual(['wallets', 'acc-1'])
    expect(PRIVATE_QUERY_ROOTS).toContain(walletKeys.all[0])
  })
})

describe('invalidateWallets', () => {
  it('invalida a lista e o perfil só da conta dada', async () => {
    const client = new QueryClient()
    client.setQueryData(walletKeys.list('acc-1'), [])
    client.setQueryData(profileKeys.detail('acc-1'), {})
    client.setQueryData(walletKeys.list('acc-2'), [])
    await invalidateWallets(client, 'acc-1')
    const invalid = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated
    expect(invalid(walletKeys.list('acc-1'))).toBe(true)
    expect(invalid(profileKeys.detail('acc-1'))).toBe(true)
    expect(invalid(walletKeys.list('acc-2'))).toBe(false)
  })
})
