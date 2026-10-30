import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@/contracts'

// Só websocket: o binding do MSW intercepta o WebSocket, não o long-polling (R1)
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  import.meta.env.VITE_SOCKET_URL,
  { transports: ['websocket'], autoConnect: false },
)
