import { useAnnouncement } from '@/lib/announcer'

/**
 * Região `aria-live` única do app (§8, MYK-1113), montada uma vez no root: recebe o `announce()` dos favoritos e
 * das mudanças em tempo real do carrinho. A mensagem é remontada a cada anúncio (`key`), então a mesma frase
 * duas vezes seguidas é lida de novo. Telas com região própria (Carteiras, Carrinho, Confirmação) seguem com ela.
 */
export function LiveAnnouncer() {
  const { id, message } = useAnnouncement()
  return (
    <div data-slot="live-announcer" aria-live="polite" aria-atomic="true" className="sr-only">
      {message && <span key={id}>{message}</span>}
    </div>
  )
}
