import { useMatches } from '@tanstack/react-router'

/**
 * O que a rota esconde abaixo de `md`: `true` = header do site **e** tab bar (a rota desenha a
 * própria moldura, como o Detalhe); `'header'` = só o header (a tab bar fica, como no Início do
 * Figma mobile, que tem a busca no topo da página e nenhum header).
 */
export type HideMobileChrome = true | 'header'

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /**
     * Abaixo de `md`, a rota desenha a própria moldura, como as telas mobile do Figma. Com `true` o
     * root esconde o header do site e a tab bar e tira o espaço reservado para a tab bar; com
     * `'header'` esconde só o header. A partir de `md` nada muda. Ligue com
     * `staticData: { hideMobileChrome: true }` (ou `'header'`).
     */
    hideMobileChrome?: HideMobileChrome
  }
}

/**
 * O que a rota casada pede em `hideMobileChrome` (`false` = nada), enquanto ela está carregando ou
 * pronta. Nos estados "não encontrado" e erro a moldura volta inteira, para a página de erro ter
 * navegação. Com mais de uma rota pedindo, vale a que esconde mais (`true`).
 */
export function useHideMobileChrome(): HideMobileChrome | false {
  return useMatches({
    select: (matches) => {
      let hide: HideMobileChrome | false = false
      for (const match of matches) {
        const value = match.staticData.hideMobileChrome
        if (!value || (match.status !== 'success' && match.status !== 'pending')) continue
        if (value === true) return true
        hide = value
      }
      return hide
    },
  })
}
