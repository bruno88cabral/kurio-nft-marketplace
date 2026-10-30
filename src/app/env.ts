// Defaults de ambiente em um só lugar: cliente e mock leem daqui e nunca divergem
export const API_URL = import.meta.env.VITE_API_URL ?? '/api'
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.kurio.mock'
