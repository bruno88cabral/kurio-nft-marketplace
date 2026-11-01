import { useMatches } from '@tanstack/react-router'

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /**
     * Abaixo de `md`, a rota desenha a própria moldura (voltar, ações, barra inferior), como as telas
     * mobile do Figma: o root esconde o header do site e a tab bar, e tira o espaço reservado para a
     * tab bar. A partir de `md` nada muda. Ligue com `staticData: { hideMobileChrome: true }`.
     */
    hideMobileChrome?: boolean
  }
}

/**
 * `true` quando alguma rota casada pede `hideMobileChrome` e está carregando ou pronta. Nos estados
 * "não encontrado" e erro a moldura volta, para a página de erro ter navegação.
 */
export function useHideMobileChrome(): boolean {
  return useMatches({
    select: (matches) =>
      matches.some(
        (match) => match.staticData.hideMobileChrome === true && (match.status === 'success' || match.status === 'pending'),
      ),
  })
}
