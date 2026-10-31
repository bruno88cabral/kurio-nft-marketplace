import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import { SOCKET_URL } from '@/app/env'
import { shouldDeliver } from './db/delivery'
import { findSession } from './handlers/session'
import { store } from './runtime'

// O handshake falso do binding anuncia pingInterval 25s + pingTimeout 5s, mas o binding não pinga.
// Sem ping, o engine.io-client derrubava a conexão aos ~30s e reconectava. O mock faz o papel do servidor.
const PING_INTERVAL_MS = 25_000
const ENGINE_IO_PING = '2'

// O socket.io-client abre <VITE_SOCKET_URL>/socket.io/?EIO=4&transport=websocket, mas o MSW
// tira o prefixo /socket.io/ da URL do cliente antes de comparar (msw 2.15, WebSocketHandler.parse).
// Por isso o link é a raiz: com '/socket.io/*' nada casa e o WebSocket real passa direto.
const realtime = ws.link(`${SOCKET_URL.replace(/\/+$/, '')}/*`)

export const socketHandlers = [
  realtime.addEventListener('connection', (connection) => {
    const io = toSocketIo(connection)

    // Token: o cliente abre com `io(url, { query: { token } })` e ele chega em `connection.client.url`
    // (`...?token=<t>&EIO=4&transport=websocket`), validado no browser. Via `auth` o token só vai no pacote
    // CONNECT (`40{"token":"..."}`), depois do handshake; sem token o CONNECT é `40` puro. Conexão sem token
    // ou com token inválido/expirado é anônima.
    const token = new URL(connection.client.url).searchParams.get('token')
    const accountId = findSession(store.getDb(), token)?.accountId ?? null

    // Sem rooms no binding: cada conexão assina o bus e filtra por conta (nft.updated vai a todas)
    const unsubscribe = store.bus.subscribe((busEvent) => {
      // `reset` não sai pelo socket (ver `shouldDeliver`)
      if (busEvent.name === 'reset' || !shouldDeliver(busEvent, accountId, store.getDb().orders)) return
      try {
        if (busEvent.name === 'nft.updated') io.client.emit('nft.updated', busEvent.event)
        else io.client.emit('order.updated', busEvent.event)
      } catch (e) {
        // Conexão já fechada ou em estado ruim: não pode quebrar a mutação nem as outras conexões
        console.error('[mocks] falha ao entregar evento ao socket', e)
      }
    })
    const heartbeat = setInterval(() => connection.client.send(ENGINE_IO_PING), PING_INTERVAL_MS)

    connection.client.addEventListener('close', () => {
      unsubscribe()
      clearInterval(heartbeat)
    })
  }),
]
