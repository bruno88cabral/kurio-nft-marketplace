import { useRef, useState } from 'react'
import { connectWallet } from '@/api/wallets'
import { captureSession } from '@/auth/sessionGuard'
import { ApiError, type Id, type Network, type Wallet } from '@/contracts'
import { NETWORKS, type WalletProvider } from '@/lib/wallets'
import { pendingAttempt, withConnectedWallet, withoutConnection, type CheckoutDraft, type CheckoutDraftStore } from './checkoutDraft'
import type { WalletConnection } from './WalletStep'

const WALLET_FAILURE_MESSAGE = 'Não foi possível conectar a carteira. Tente de novo.'

export interface WalletConnectionState {
  /** A carteira da tentativa pendente; senão a escolhida (se ainda cadastrada), ou a principal. */
  selectedId: Id | undefined
  /** A carteira cadastrada de `selectedId`. */
  selected: Wallet | undefined
  /** A escolhida está conectada (`connectedWalletId` do rascunho). */
  connected: boolean
  connection: WalletConnection
  /** Trocar de carteira desconecta a anterior. Com tentativa pendente não faz nada (a carteira fica travada). */
  selectWallet: (walletId: Id) => void
  /** Redes que têm alguma carteira cadastrada, na ordem de `NETWORKS`. */
  networks: readonly Network[]
  /**
   * Escolhe a primeira carteira cadastrada daquela rede (a principal antes, ordem de `sortWallets`). A rede não é
   * um estado à parte: é a da carteira. Trocar desconecta; já estar nessa rede não muda nada.
   */
  selectNetwork: (network: Network) => void
  /** "Usar outra carteira?": a escolhida não é a principal (derivado, não é estado novo). */
  useOther: boolean
  /** Desligar volta à principal; ligar escolhe a primeira não principal (se não houver, nada muda). */
  setUseOther: (on: boolean) => void
  /** O provedor da conexão simulada (`draft.provider`), só de UI: o pedido não o leva. */
  provider: WalletProvider | undefined
  /** Trocar de provedor desconecta. */
  selectProvider: (provider: WalletProvider) => void
  /** `POST /wallets/:id/connect` da escolhida, com o provedor escolhido (sem provedor não conecta). A resposta só conecta se a carteira e o provedor ainda forem os escolhidos. */
  connect: () => Promise<void>
  /** Tira só a conexão do rascunho (`withoutConnection`); não há endpoint de desconexão. */
  disconnect: () => void
}

/**
 * A etapa "Carteira e rede" do Pagamento: carteira cadastrada (e a rede dela), provedor e conexão, gravados no
 * rascunho (`kurio:checkout:<accountId>`). Com tentativa pendente nada disso muda (R4).
 */
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
  // A conexão em andamento (carteira e provedor de quando começou) e o número da última, para que uma resposta
  // antiga não apague o "Conectando…" de uma nova
  const [inFlight, setInFlight] = useState<{ walletId: Id; provider: WalletProvider }>()
  const lastConnect = useRef(0)
  const [walletError, setWalletError] = useState<string>()
  // Só depois de um "Desconectar" explícito, em memória: o rascunho guarda conexão, não a história dela
  const [disconnected, setDisconnected] = useState(false)

  const pending = pendingAttempt(draft)
  // Com tentativa pendente vale a carteira dela; senão a escolhida, ou a principal
  const selectedId: Id | undefined =
    pending?.body.walletId ?? (wallets?.some((w) => w.id === draft.walletId) ? draft.walletId : wallets?.[0]?.id)
  const selected = wallets?.find((w) => w.id === selectedId)
  const provider = draft.provider
  const connected = selectedId !== undefined && draft.connectedWalletId === selectedId
  const connecting = inFlight !== undefined && inFlight.walletId === selectedId && inFlight.provider === provider
  const connection: WalletConnection = connected
    ? { status: 'connected' }
    : connecting
      ? { status: 'connecting' }
      : walletError
        ? { status: 'rejected', message: walletError }
        : disconnected
          ? { status: 'disconnected' }
          : { status: 'idle' }

  const resetFeedback = () => {
    setWalletError(undefined)
    setDisconnected(false)
  }

  const selectWallet = (walletId: Id) => {
    if (pending || walletId === selectedId) return
    resetFeedback()
    // Trocar de carteira desconecta a anterior
    drafts.set({ ...withoutConnection(drafts.get()), walletId })
  }

  const networks = NETWORKS.filter((network) => wallets?.some((w) => w.network === network))

  const selectNetwork = (network: Network) => {
    if (pending || selected?.network === network) return
    const target = wallets?.find((w) => w.network === network)
    if (target) selectWallet(target.id)
  }

  const useOther = selected !== undefined && selected.role !== 'primary'

  const setUseOther = (on: boolean) => {
    if (pending || on === useOther) return
    const target = on ? wallets?.find((w) => w.role !== 'primary') : (wallets?.find((w) => w.role === 'primary') ?? wallets?.[0])
    if (target) selectWallet(target.id)
  }

  const selectProvider = (next: WalletProvider) => {
    if (pending || next === provider) return
    resetFeedback()
    // Trocar de provedor desconecta
    drafts.set({ ...withoutConnection(drafts.get()), provider: next })
  }

  const connect = async () => {
    if (!selectedId || !provider || connecting) return
    const sameSession = captureSession()
    const walletId = selectedId
    const id = ++lastConnect.current
    // A carteira e o provedor ainda são os de quando a conexão começou?
    const stillChosen = () => {
      const current = drafts.get()
      return current.provider === provider && (current.walletId === undefined || current.walletId === walletId)
    }
    setInFlight({ walletId, provider })
    resetFeedback()
    try {
      await connectWallet(walletId)
      if (!sameSession() || !stillChosen()) return
      // A pessoa trocou de carteira durante a conexão: a resposta atrasada não desfaz a troca
      const next = withConnectedWallet(drafts.get(), walletId)
      if (next) drafts.set(next)
    } catch (error) {
      if (!sameSession() || !stillChosen() || id !== lastConnect.current) return
      setWalletError(error instanceof ApiError && error.status === 409 ? error.message : WALLET_FAILURE_MESSAGE)
    } finally {
      if (id === lastConnect.current) setInFlight(undefined)
    }
  }

  const disconnect = () => {
    if (pending || !connected) return
    resetFeedback()
    drafts.set(withoutConnection(drafts.get()))
    setDisconnected(true)
  }

  return {
    selectedId,
    selected,
    connected,
    connection,
    selectWallet,
    networks,
    selectNetwork,
    useOther,
    setUseOther,
    provider,
    selectProvider,
    connect,
    disconnect,
  }
}
