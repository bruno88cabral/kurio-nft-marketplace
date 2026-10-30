import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { apiClient } from '@/api/client'
import { ApiError, type HealthStatus, type NftUpdatedEvent } from '@/contracts'
import { socket } from '@/realtime/socket'

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Início · Kurio' }] }),
  component: HomePage,
})

function HomePage() {
  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-heading">Início</h1>
      <RealtimeDebugPanel />
    </main>
  )
}

// TEMPORÁRIO (spike R1, MYK-1057): prova de MSW + Socket.IO mockado. Sai na MYK-1049.
// Só exibe o que chega pelo MSW e pelo socket; nada de dado fictício aqui.
function RealtimeDebugPanel() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await apiClient.get<HealthStatus>('/health')).data,
  })
  const [connected, setConnected] = useState(socket.connected)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [lastEvent, setLastEvent] = useState<NftUpdatedEvent | null>(null)
  const [eventCount, setEventCount] = useState(0)

  useEffect(() => {
    const onConnect = () => {
      setConnected(true)
      setConnectError(null)
    }
    const onDisconnect = () => setConnected(false)
    const onConnectError = (error: Error) => setConnectError(error.message)
    const onNftUpdated = (event: NftUpdatedEvent) => {
      setLastEvent(event)
      setEventCount((count) => count + 1)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('nft.updated', onNftUpdated)
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('nft.updated', onNftUpdated)
    }
  }, [])

  return (
    <section
      aria-label="Debug do tempo real"
      className="flex flex-col gap-2 rounded-md border p-4 font-mono text-body"
    >
      <p>
        health:{' '}
        {health.isPending
          ? 'carregando'
          : health.isError
            ? describeError(health.error)
            : JSON.stringify(health.data)}
      </p>
      <p>socket: {connected ? 'connected' : 'disconnected'}</p>
      {connectError && <p>socket connect_error: {connectError}</p>}
      <p>nft.updated recebidos: {eventCount}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap text-caption">
        último nft.updated: {lastEvent ? JSON.stringify(lastEvent, null, 2) : 'nenhum'}
      </pre>
    </section>
  )
}

function describeError(error: Error) {
  if (error instanceof ApiError) {
    return `ApiError(code=${error.code}, status=${error.status ?? 'sem resposta'}): ${error.message}`
  }
  return `${error.name}: ${error.message}`
}
