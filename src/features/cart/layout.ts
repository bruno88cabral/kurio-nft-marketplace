/** Classes compartilhadas pelo Carrinho e pelo Pagamento (mesma moldura e mesma coluna do resumo). */
export const PAGE_CLASS = 'mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 pb-8 md:px-6 md:py-8'
export const GRID_CLASS = 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10'
/** `ui/button` só estiliza `disabled:`; o CTA bloqueado usa `aria-disabled` (foco preservado), então estiliza aqui. */
export const BLOCKED_CTA_CLASS =
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-primary aria-disabled:active:translate-y-0'
