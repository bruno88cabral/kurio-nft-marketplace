/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_ENABLE_MOCKS?: string
  readonly VITE_SOCKET_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  /** Hook de teste do mock; só existe com `VITE_ENABLE_MOCKS=true`. */
  __kurioMock?: import('./mocks/devtools').KurioMock
}
