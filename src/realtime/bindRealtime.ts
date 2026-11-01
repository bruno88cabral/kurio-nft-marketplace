import type { QueryClient } from '@tanstack/react-query'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/contracts'
import { applyNftUpdated, applyOrderUpdated, invalidateAfterReconnect } from './applyEvents'
import type { Reconciler } from './reconcile'

/**
 * Motivo do `disconnect` quando o próprio cliente fecha a conexão (`socket.disconnect()`). É o que o
 * `reconnectSocket` faz no boot, no login, no logout e na expiração: reconexão proposital, sem evento perdido
 * que justifique refazer o cache (o reset privado já cuida das chaves da conta).
 */
export const CLIENT_DISCONNECT_REASON = 'io client disconnect'

/** O que o `bindRealtime` usa do socket (o `Socket` do socket.io-client satisfaz; os testes passam um falso). */
export interface RealtimeSource {
  on(event: 'nft.updated', listener: (event: NftUpdatedEvent) => void): unknown
  on(event: 'order.updated', listener: (event: OrderUpdatedEvent) => void): unknown
  on(event: 'connect', listener: () => void): unknown
  on(event: 'disconnect', listener: (reason: string) => void): unknown
  off(event: 'nft.updated', listener: (event: NftUpdatedEvent) => void): unknown
  off(event: 'order.updated', listener: (event: OrderUpdatedEvent) => void): unknown
  off(event: 'connect', listener: () => void): unknown
  off(event: 'disconnect', listener: (reason: string) => void): unknown
}

export interface BindRealtimeDeps {
  socket: RealtimeSource
  queryClient: QueryClient
  reconciler: Reconciler
}

/**
 * Liga os eventos ao cache: todo evento passa pelo `reconciler.accept` (dedupe e versão) antes de aplicar.
 *
 * Reconexão: queda é todo `disconnect` que não foi o cliente (`transport close`, `ping timeout`, `io server
 * disconnect`…). O próximo `connect` depois de uma queda invalida `nfts`, `cart` e `orders`, inclusive se esse
 * `connect` vier de um `reconnectSocket` (ex.: login durante a queda: os eventos do intervalo também se perderam).
 * O `connect` do boot e o que segue um `disconnect` do cliente não invalidam nada.
 * Devolve a função que desliga tudo.
 */
export function bindRealtime({ socket, queryClient, reconciler }: BindRealtimeDeps): () => void {
  let dropped = false

  const onNft = (event: NftUpdatedEvent) => {
    if (reconciler.accept(event)) applyNftUpdated(queryClient, event)
  }
  const onOrder = (event: OrderUpdatedEvent) => {
    if (reconciler.accept(event)) applyOrderUpdated(queryClient, event)
  }
  const onDisconnect = (reason: string) => {
    if (reason !== CLIENT_DISCONNECT_REASON) dropped = true
  }
  const onConnect = () => {
    if (!dropped) return
    dropped = false
    void invalidateAfterReconnect(queryClient)
  }

  socket.on('nft.updated', onNft)
  socket.on('order.updated', onOrder)
  socket.on('disconnect', onDisconnect)
  socket.on('connect', onConnect)
  return () => {
    socket.off('nft.updated', onNft)
    socket.off('order.updated', onOrder)
    socket.off('disconnect', onDisconnect)
    socket.off('connect', onConnect)
  }
}
