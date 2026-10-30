import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type { NftUpdatedEvent } from '@/contracts'
import { SOCKET_URL } from '@/app/env'
import { parseEth } from '@/lib/eth'

const EMIT_INTERVAL_MS = 5_000
// O handshake falso do binding anuncia pingInterval 25s + pingTimeout 5s, mas o binding não pinga.
// Sem ping, o engine.io-client derruba a conexão aos ~30s e reconecta. O mock faz o papel do servidor.
const PING_INTERVAL_MS = 25_000
const ENGINE_IO_PING = '2'

// O socket.io-client abre <VITE_SOCKET_URL>/socket.io/?EIO=4&transport=websocket, mas o MSW
// tira o prefixo /socket.io/ da URL do cliente antes de comparar (msw 2.15, WebSocketHandler.parse).
// Por isso o link é a raiz: com '/socket.io/*' nada casa e o WebSocket real passa direto.
const realtime = ws.link(`${SOCKET_URL.replace(/\/+$/, '')}/*`)

export const socketHandlers = [
  realtime.addEventListener('connection', (connection) => {
    const io = toSocketIo(connection)
    let version = 0

    // Payload provisório do spike; as fixtures reais chegam com o banco em memória (MYK-1048)
    const emitNftUpdated = () => {
      version += 1
      const event: NftUpdatedEvent = {
        eventId: crypto.randomUUID(),
        resource: { type: 'nft', id: 'spike-nft' },
        version,
        occurredAt: new Date().toISOString(),
        payload: {
          id: 'spike-nft',
          price: parseEth('0.1'),
          editions: [{ kind: '1/10', available: 10 - (version % 10), total: 10 }],
        },
      }
      io.client.emit('nft.updated', event)
    }

    // O binding manda o handshake do Engine.IO/Socket.IO numa microtask; o primeiro evento sai depois dele
    const first = setTimeout(emitNftUpdated, 0)
    const interval = setInterval(emitNftUpdated, EMIT_INTERVAL_MS)
    const heartbeat = setInterval(() => connection.client.send(ENGINE_IO_PING), PING_INTERVAL_MS)

    connection.client.addEventListener('close', () => {
      clearTimeout(first)
      clearInterval(interval)
      clearInterval(heartbeat)
    })
  }),
]
