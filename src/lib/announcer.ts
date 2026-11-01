import { useSyncExternalStore } from 'react'

/** Último anúncio; `id` sobe a cada chamada, para a mesma frase duas vezes seguidas ser lida de novo. */
export interface Announcement {
  id: number
  message: string
}

let current: Announcement = { id: 0, message: '' }
const listeners = new Set<() => void>()

/**
 * Anuncia uma frase na região `aria-live="polite"` única do app (`LiveAnnouncer`, montado no root). Para resultados
 * de ações e mudanças em tempo real que não têm região própria na tela (favoritos, linha do carrinho).
 */
export function announce(message: string) {
  current = { id: current.id + 1, message }
  for (const listener of listeners) listener()
}

/** Limpa a região (ex.: o anúncio era de uma sessão que acabou). */
export function clearAnnouncement() {
  if (current.message === '') return
  current = { id: current.id + 1, message: '' }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => current

export function useAnnouncement(): Announcement {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
