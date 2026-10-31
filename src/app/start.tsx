import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { onUnauthorized } from '@/api/client'
import { queryClient } from '@/app/queryClient'
import { router } from '@/app/router'
import { SESSION_QUERY_KEY } from '@/auth/useSession'
import { socket } from '@/realtime/socket'

// 401 com token: o client já limpou a sessão; aqui o cache de ['session'] refaz (sem token, a query fica desabilitada)
onUnauthorized(() => void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }))

// Carregado por main.tsx só depois do enableMocks(); ver o comentário lá
socket.connect()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
