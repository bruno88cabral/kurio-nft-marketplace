import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { toast } from 'sonner'
import { mergeCart } from '@/api/cart'
import { onUnauthorized } from '@/api/client'
import { queryClient } from '@/app/queryClient'
import { router } from '@/app/router'
import { isSessionStorageEvent, sessionLifecycle } from '@/auth/sessionLifecycle'
import { clearAnonymousCart, readAnonymousCart } from '@/features/cart/anonymousCart'
import { mergeAnonymousCartOnLogin } from '@/features/cart/mergeOnLogin'
import { dropWalletConnections } from '@/features/checkout/checkoutDraft'
import { bindRealtime } from '@/realtime/bindRealtime'
import { createReconciler } from '@/realtime/reconcile'
import { socket } from '@/realtime/socket'

// Expiração: o lifecycle navega pelo router injetado aqui (importá-lo lá criaria o ciclo router -> rotas -> lifecycle)
sessionLifecycle.setExpiredNavigation({
  location: () => router.state.location,
  toLogin: (redirect) => void router.navigate({ to: '/login', search: { redirect } }),
})

// 401 com o token atual: o client já limpou a sessão; aqui vem o reset privado, o toast e o /login?redirect=
onUnauthorized((token) => void sessionLifecycle.notifyExpired(token))

// Várias abas: o mock é "uma aba por vez"; se outra aba entra, sai ou troca de conta, esta zera o
// estado privado e recarrega para ler a sessão nova (MYK-1069)
window.addEventListener('storage', (event) => {
  if (!isSessionStorageEvent(event)) return
  void sessionLifecycle.resetPrivateState().finally(() => location.reload())
})

// Login ou cadastro: o carrinho do visitante (`kurio:cart`) entra no da conta (MYK-1088)
sessionLifecycle.onSessionEstablished((auth) =>
  mergeAnonymousCartOnLogin(auth, {
    queryClient,
    read: readAnonymousCart,
    clear: clearAnonymousCart,
    merge: mergeCart,
    notifyError: (message) => void toast.error(message),
    sameSession: sessionLifecycle.captureSession(),
  }),
)

// A conexão da carteira no checkout é da sessão: cai em todo reset privado (logout incluído). A tentativa de pedido
// pendente (chave + corpo) fica no rascunho: apagá-la abriria caminho para um pedido duplicado (R4, MYK-1103)
sessionLifecycle.onPrivateReset(() => dropWalletConnections())

// Tempo real no cache (MYK-1091): `nft.updated`/`order.updated` passam pelo reconciliador (dedupe por `eventId`,
// descarte por `version`); a reconexão por queda refaz `nfts`, `cart` e `orders`. Ligado antes do primeiro connect
// (`resumeSession` logo abaixo) para nenhum evento chegar sem ouvinte. O reset privado zera o reconciliador.
const reconciler = createReconciler()
bindRealtime({ socket, queryClient, reconciler })
sessionLifecycle.onPrivateReset(reconciler.reset)

// Carregado por main.tsx só depois do enableMocks(); ver o comentário lá.
// Socket com o token guardado (refresh logado não fica anônimo) e timer de expiração armado
sessionLifecycle.resumeSession()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
