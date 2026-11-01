/**
 * Caixas compartilhadas entre o Detalhe e o skeleton dele (mesmas dimensões, sem CLS na troca).
 *
 * Abaixo de `md` o Detalhe segue o Figma mobile, sem o header do site nem a tab bar (a rota liga
 * `staticData.hideMobileChrome`): a página não tem padding lateral, o topo (`DETAIL_HERO_CLASS`)
 * é um bloco `#241612` com voltar, favoritar e a arte, e o conteúdo (`DETAIL_PANEL_CLASS`) é um
 * painel com cantos arredondados que sobe sobre a arte.
 */
export const DETAIL_PAGE_CLASS = 'mx-auto flex w-full max-w-7xl flex-col gap-10 md:gap-16 md:px-6 md:pt-6'
/** Breadcrumb (a partir de `md`) + grade de arte e compra. */
export const DETAIL_TOP_CLASS = 'flex flex-col md:gap-4'
export const DETAIL_GRID_CLASS = 'grid md:grid-cols-2 md:items-start md:gap-8 lg:gap-10'
export const DETAIL_HERO_CLASS = 'bg-card flex min-w-0 flex-col gap-4 px-5 pt-4 md:bg-transparent md:p-0'
export const DETAIL_PANEL_CLASS =
  'bg-card relative z-10 -mt-8 flex min-w-0 flex-col gap-5 rounded-t-[2rem] px-5 pt-7 pb-8 md:mt-0 md:gap-4 md:rounded-none md:bg-transparent md:p-0'
/** Seções abaixo da compra (detalhes, "Mais desta coleção"): padding lateral só no mobile. */
export const DETAIL_SECTION_CLASS = 'px-4 md:px-0'

/** Galeria: no mobile só a arte (miniaturas flutuando sobre ela); a partir de `md`, coluna de miniaturas à esquerda. */
export const GALLERY_CLASS =
  'relative flex min-w-0 flex-col md:grid md:grid-cols-[3rem_minmax(0,1fr)] md:gap-3 lg:grid-cols-[6.5rem_minmax(0,1fr)] lg:gap-6'
/** Painel `#241612` da arte principal (a partir de `md`). */
export const GALLERY_MAIN_CLASS = 'relative md:col-start-2 md:row-start-1 md:bg-card md:p-4 lg:p-5'
/** A arte: no mobile só os cantos de cima são arredondados (o painel cobre a base). */
export const GALLERY_ART_CLASS = 'bg-muted aspect-square overflow-hidden rounded-t-[2rem] md:rounded-2xl'
