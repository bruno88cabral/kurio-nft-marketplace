import '@/index.css'

// Import dinâmico: o MSW fica fora do chunk de entrada (R2)
async function enableMocks() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

// O app inteiro só é avaliado depois do worker. O engine.io-client guarda `globalThis.WebSocket`
// quando o módulo é avaliado; se o socket.io-client carregar antes do patch do MSW, o socket
// abre um WebSocket real e o mock não intercepta (R1). Por isso nada aqui importa o app estaticamente.
void enableMocks().then(() => import('./app/start'))
