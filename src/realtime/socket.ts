import { io, type Socket } from 'socket.io-client'
import { SOCKET_URL } from '@/app/env'
import type { ClientToServerEvents, ServerToClientEvents } from '@/contracts'

// Só websocket: o binding do MSW intercepta o WebSocket, não o long-polling (R1)
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: false,
})

/**
 * Reabre a conexão com o token da sessão atual (ou anônima com `null`). O mock lê `?token=` uma vez só,
 * no connect (`src/mocks/socket.ts`), por isso login, logout, troca de conta e o boot reconectam.
 */
export function reconnectSocket(token: string | null): void {
  socket.disconnect()
  socket.io.opts.query = token ? { token } : {}
  socket.connect()
}
