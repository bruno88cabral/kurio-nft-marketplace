import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { onUnauthorized } from '@/api/client'
import { queryClient } from '@/app/queryClient'
import { router } from '@/app/router'
import { isSessionStorageEvent, sessionLifecycle } from '@/auth/sessionLifecycle'

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
