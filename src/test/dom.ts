/** Polyfills de jsdom para o que o Radix e o layout usam. Idempotente: só define o que estiver ausente. */
export function installDomPolyfills(): void {
  if (typeof window === 'undefined') return

  if (typeof window.ResizeObserver === 'undefined') {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    window.ResizeObserver = ResizeObserverStub
    globalThis.ResizeObserver = ResizeObserverStub
  }

  const proto = Element.prototype
  if (!proto.scrollIntoView) proto.scrollIntoView = () => {}
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {}
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {}

  if (!window.matchMedia) {
    window.matchMedia = (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })
  }
}

/** Zera o que os testes gravam no navegador (`kurio:session`, `kurio:cart`, `kurio:mock-db:v1`...). */
export function resetBrowserStorage(): void {
  localStorage.clear()
  sessionStorage.clear()
}
