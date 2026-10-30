import { io, type Socket } from 'socket.io-client'
import { SOCKET_URL } from '@/app/env'
import type { ClientToServerEvents, ServerToClientEvents } from '@/contracts'

// Só websocket: o binding do MSW intercepta o WebSocket, não o long-polling (R1)
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: false,
})
