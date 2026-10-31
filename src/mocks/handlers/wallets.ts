import { http, HttpResponse } from 'msw'
import { API_URL } from '@/app/env'
import type { Id, Network, Wallet, WalletRole } from '@/contracts'
import { newId } from '../db/ids'
import { scenario, store } from '../runtime'
import { apiError, notFound, readJson, str, validationError, raise } from './errors'
import { assertOwner, requireSession } from './session'
import { withScenario } from './withScenario'

const NETWORKS: readonly Network[] = ['ethereum', 'polygon', 'arbitrum', 'optimism']
const ROLES: readonly WalletRole[] = ['primary', 'secondary']
const ADDRESS = /^0x[0-9a-fA-F]{40}$/
export const MAX_LABEL = 40

/** Procura a carteira em todas as contas; o dono vem junto para o `assertOwner` (403 em vez de 404). */
function findWallet(walletId: Id): { ownerId: Id; wallet: Wallet } | null {
  for (const [ownerId, wallets] of Object.entries(store.getDb().wallets)) {
    const wallet = wallets.find((w) => w.id === walletId)
    if (wallet) return { ownerId, wallet }
  }
  return null
}

function ownWallet(request: Request, walletId: Id): { accountId: Id; wallet: Wallet } {
  const { accountId } = requireSession(request)
  const found = findWallet(walletId)
  if (!found) raise(notFound('Carteira não encontrada.'))
  assertOwner({ accountId }, found.ownerId)
  return { accountId, wallet: found.wallet }
}

function validLabel(raw: unknown, fieldErrors: Record<string, string>): string | undefined {
  if (raw === undefined) return undefined
  const label = str(raw)?.trim()
  if (!label) fieldErrors.label = 'Informe um apelido.'
  else if (label.length > MAX_LABEL) fieldErrors.label = `Use até ${MAX_LABEL} caracteres.`
  return label
}

export const walletHandlers = [
  http.get(
    `${API_URL}/wallets`,
    withScenario('GET', '/wallets', ({ request }) => {
      const { accountId } = requireSession(request)
      return HttpResponse.json<Wallet[]>(store.getDb().wallets[accountId] ?? [])
    }),
  ),

  http.post(
    `${API_URL}/wallets`,
    withScenario('POST', '/wallets', async ({ request }) => {
      const { accountId } = requireSession(request)
      const body = await readJson(request)
      const fieldErrors: Record<string, string> = {}

      const address = str(body.address)?.trim() ?? ''
      if (!ADDRESS.test(address)) fieldErrors.address = 'Endereço inválido. Use 0x seguido de 40 hexadecimais.'
      const network = NETWORKS.find((n) => n === body.network)
      if (!network) fieldErrors.network = `Rede inválida. Use: ${NETWORKS.join(', ')}.`
      const label = validLabel(body.label, fieldErrors)
      if (Object.keys(fieldErrors).length > 0 || !network) raise(validationError(fieldErrors))

      const wallet = store.mutate((db, touch) => {
        const wallets = (db.wallets[accountId] ??= [])
        if (wallets.some((w) => w.network === network && w.address.toLowerCase() === address.toLowerCase())) {
          raise(apiError(409, 'conflict', 'Esta carteira já está conectada.'))
        }
        const created: Wallet = {
          id: newId(),
          address,
          network,
          // A primeira carteira da conta é sempre a principal
          role: wallets.length === 0 ? 'primary' : 'secondary',
          label: label ?? `Carteira ${wallets.length + 1}`,
        }
        wallets.push(created)
        touch('wallet', created.id)
        return created
      })
      return HttpResponse.json<Wallet>(wallet, { status: 201 })
    }),
  ),

  http.patch(
    `${API_URL}/wallets/:walletId`,
    withScenario('PATCH', '/wallets/:walletId', async ({ request, params }) => {
      const walletId = String(params.walletId)
      const { accountId } = ownWallet(request, walletId)
      const body = await readJson(request)
      const fieldErrors: Record<string, string> = {}

      const label = validLabel(body.label, fieldErrors)
      const role = ROLES.find((r) => r === body.role)
      if (body.role !== undefined && !role) fieldErrors.role = `Papel inválido. Use: ${ROLES.join(', ')}.`
      if (Object.keys(fieldErrors).length > 0) raise(validationError(fieldErrors))

      const updated = store.mutate((db, touch) => {
        const wallets = db.wallets[accountId]
        const wallet = wallets.find((w) => w.id === walletId)
        if (!wallet) raise(notFound('Carteira não encontrada.'))
        if (label !== undefined) wallet.label = label
        if (role === 'primary' && wallet.role !== 'primary') {
          // Um `primary` por conta: promover rebaixa o anterior
          for (const other of wallets) {
            if (other.role === 'primary') {
              other.role = 'secondary'
              touch('wallet', other.id)
            }
          }
          wallet.role = 'primary'
        } else if (role === 'secondary' && wallet.role === 'primary') {
          raise(validationError({ role: 'Defina outra carteira como principal em vez de rebaixar esta.' }))
        }
        touch('wallet', wallet.id)
        return wallet
      })
      return HttpResponse.json<Wallet>(updated)
    }),
  ),

  // Desconecta. Se era a principal, a primeira restante assume o papel
  http.delete(
    `${API_URL}/wallets/:walletId`,
    withScenario('DELETE', '/wallets/:walletId', ({ request, params }) => {
      const walletId = String(params.walletId)
      const { accountId } = ownWallet(request, walletId)
      store.mutate((db, touch) => {
        const removed = db.wallets[accountId].find((w) => w.id === walletId)
        db.wallets[accountId] = db.wallets[accountId].filter((w) => w.id !== walletId)
        touch('wallet', walletId)
        const [next] = db.wallets[accountId]
        if (removed?.role === 'primary' && next) {
          next.role = 'primary'
          touch('wallet', next.id)
        }
      })
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  // Simula a conexão com a carteira; `wallet-rejected` recusa. Não altera o estado
  http.post(
    `${API_URL}/wallets/:walletId/connect`,
    withScenario('POST', '/wallets/:walletId/connect', ({ request, params }) => {
      const { wallet } = ownWallet(request, String(params.walletId))
      if (scenario.rules?.walletConnect === 'reject') {
        raise(apiError(409, 'conflict', 'A carteira recusou a conexão. Aprove o pedido no app da carteira e tente de novo.'))
      }
      return HttpResponse.json<Wallet>(wallet)
    }),
  ),
]
