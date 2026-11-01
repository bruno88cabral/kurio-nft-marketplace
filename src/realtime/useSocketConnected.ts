import { useSyncExternalStore } from 'react'
import { socket } from './socket'

function subscribe(onChange: () => void) {
  socket.on('connect', onChange)
  socket.on('disconnect', onChange)
  return () => {
    socket.off('connect', onChange)
    socket.off('disconnect', onChange)
  }
}

const getConnected = () => socket.connected

/**
 * `socket.connected`, reativo: re-renderiza quando o socket cai ou volta. A Confirmação usa para ligar o
 * polling só com o socket fora (o `refetchInterval` é reavaliado quando a função muda de identidade).
 */
export function useSocketConnected(): boolean {
  return useSyncExternalStore(subscribe, getConnected, getConnected)
}
