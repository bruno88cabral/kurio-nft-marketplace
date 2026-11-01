import { useState } from 'react'
import { connectWallet } from '@/api/wallets'
import { captureSession } from '@/auth/sessionGuard'
import { ApiError, type Id, type Wallet } from '@/contracts'
import { pendingAttempt, withConnectedWallet, withoutConnection, type CheckoutDraft, type CheckoutDraftStore } from './checkoutDraft'
import type { WalletConnection } from './WalletStep'

const WALLET_FAILURE_MESSAGE = 'Não foi possível conectar a carteira. Tente de novo.'

export interface WalletConnectionState {
  /** A carteira da tentativa pendente; senão a escolhida (se ainda cadastrada), ou a principal. */
  selectedId: Id | undefined
  /** A escolhida está conectada (`connectedWalletId` do rascunho). */
  connected: boolean
  connection: WalletConnection
  /** Trocar de carteira desconecta a anterior. Com tentativa pendente não faz nada (a carteira fica travada). */
  selectWallet: (walletId: Id) => void
  /** `POST /wallets/:id/connect` da escolhida; a resposta só conecta se ela ainda for a escolhida. */
  connect: () => Promise<void>
}

/** A etapa "Carteira" do Pagamento: seleção e conexão, gravadas no rascunho (`kurio:checkout:<accountId>`). */
export function useWalletConnection({
  draft,
  drafts,
  wallets,
}: {
  draft: CheckoutDraft
  drafts: CheckoutDraftStore
  /** As carteiras em ordem (`sortWallets`); `undefined` enquanto carregam. */
  wallets: readonly Wallet[] | undefined
}): WalletConnectionState {
  const [connecting, setConnecting] = useState(false)
  const [walletError, setWalletError] = useState<string>()

  const pending = pendingAttempt(draft)
  // Com tentativa pendente vale a carteira dela; senão a escolhida, ou a principal
  const selectedId: Id | undefined =
    pending?.body.walletId ?? (wallets?.some((w) => w.id === draft.walletId) ? draft.walletId : wallets?.[0]?.id)
  const connected = selectedId !== undefined && draft.connectedWalletId === selectedId
  const connection: WalletConnection = connected
    ? { status: 'connected' }
    : connecting
      ? { status: 'connecting' }
      : walletError
        ? { status: 'rejected', message: walletError }
        : { status: 'idle' }

  const selectWallet = (walletId: Id) => {
    if (pending || walletId === selectedId) return
    setWalletError(undefined)
    // Trocar de carteira desconecta a anterior
    drafts.set({ ...withoutConnection(drafts.get()), walletId })
  }

  const connect = async () => {
    if (!selectedId || connecting) return
    const sameSession = captureSession()
    const walletId = selectedId
    setConnecting(true)
    setWalletError(undefined)
    try {
      await connectWallet(walletId)
      if (!sameSession()) return
      // A pessoa trocou de carteira durante a conexão: a resposta atrasada não desfaz a troca
      const next = withConnectedWallet(drafts.get(), walletId)
      if (next) drafts.set(next)
    } catch (error) {
      if (!sameSession()) return
      setWalletError(error instanceof ApiError && error.status === 409 ? error.message : WALLET_FAILURE_MESSAGE)
    } finally {
      setConnecting(false)
    }
  }

  return { selectedId, connected, connection, selectWallet, connect }
}
