/** Classes compartilhadas pelo Carrinho e pelo Pagamento (mesma moldura e mesma coluna do resumo). */
export const PAGE_CLASS = 'mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 pb-8 md:px-6 md:py-8'
export const GRID_CLASS = 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10'
/**
 * Grade do Carrinho (Figma desktop): a mesma coluna de 22rem do resumo do Pagamento (no PNG ela mede ~330 px),
 * com mais respiro entre a tabela e o resumo, como no Figma.
 */
export const CART_GRID_CLASS = 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-x-20'
/**
 * Colunas da tabela do Carrinho a partir de `md`: arte, NFT, Preço, Edições, Total e a lixeira. O
 * cabeçalho ("NFTs | Preço | Edições | Total") e as linhas usam a mesma grade para alinhar.
 */
export const CART_COLUMNS_CLASS =
  'md:grid-cols-[4.5rem_minmax(0,1fr)_6rem_7.5rem_6.5rem_2.75rem] md:gap-x-4 lg:grid-cols-[5.25rem_minmax(0,1fr)_7rem_8rem_7.5rem_2.75rem]'
/** `ui/button` só estiliza `disabled:`; o CTA bloqueado usa `aria-disabled` (foco preservado), então estiliza aqui. */
export const BLOCKED_CTA_CLASS =
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-primary aria-disabled:active:translate-y-0'
