import { useQueries } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { LoaderCircle, ShoppingCart } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { nftDetailQuery } from '@/api/nfts'
import { useSession } from '@/auth/useSession'
import type { Cart } from '@/contracts'
import { CouponInput, EmptyState, ErrorState, PriceSummary } from '@/components/kurio'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MobileBackButton } from '@/features/nft-detail/MobileDetailChrome'
import { cn } from '@/lib/utils'
import { CartLine } from './CartLine'
import { CHECKOUT_BLOCK_MESSAGE, couponStatus, lineKey } from './cartView'
import { BLOCKED_CTA_CLASS, CART_COLUMNS_CLASS, CART_GRID_CLASS, PAGE_CLASS } from './layout'
import { QuoteErrorState } from './QuoteErrorState'
import { QUOTE_ISSUES_MESSAGE, useCartQuote } from './useCartQuote'
import { useCart } from './useCart'
import { useCouponActions } from './useCouponActions'

const CRUMB_CLASS =
  'text-foreground hover:text-text-accent focus-visible:ring-ring rounded-sm font-bold outline-none focus-visible:ring-3'
/**
 * Resumo (Figma): no desktop fica direto sobre o fundo, sem card, na coluna da direita (`sticky`); no celular é o
 * painel inferior `#241612` de largura total com os cantos de cima arredondados, no fluxo, logo depois da lista
 * (não é fixo: com cupom, valores e CTA ele cobriria metade da tela).
 */
const SUMMARY_PANEL_CLASS =
  'flex min-w-0 flex-col gap-5 max-md:bg-card max-md:-mx-4 max-md:-mb-8 max-md:rounded-t-[2rem] max-md:px-5 max-md:pt-7 max-md:pb-8 lg:sticky lg:top-24'
const SUMMARY_TITLE_CLASS = 'text-body-lg border-border-soft border-b pb-2 font-bold max-md:sr-only'
/** CTA largo e laranja; no celular, a pílula com gradiente do Figma mobile. */
const CTA_CLASS =
  'text-body h-12 w-full font-bold max-md:from-text-accent max-md:to-primary max-md:h-14 max-md:rounded-full max-md:bg-linear-to-r'

/**
 * Carrinho (`/cart`, rota pública). Visitante: linhas com o preço do catálogo, sem total nem cupom, com o
 * convite para entrar. Logado: resumo da cotação (`POST /quotes`), cupom e "Conectar e finalizar".
 * Nada é somado entre linhas: todo valor do resumo vem da cotação, e o total de cada linha
 * (`mulEth(unitPrice, quantity)`) é só exibição. O `<main>` é o do root.
 */
export function CartPage() {
  const cart = useCart()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [announcement, setAnnouncement] = useState('')
  const [retrying, setRetrying] = useState(false)

  let body
  if (cart.isError) {
    body = (
      <ErrorState
        title="Não foi possível carregar o carrinho."
        description="Verifique sua conexão e tente de novo."
        retrying={retrying}
        onRetry={() => {
          setRetrying(true)
          void cart.refetch().finally(() => setRetrying(false))
        }}
      />
    )
  } else if (cart.isPending) {
    body = <CartSkeleton />
  } else if (cart.items.length === 0) {
    body = (
      <EmptyState
        icon={<ShoppingCart />}
        title="Seu carrinho está vazio"
        description="Escolha um NFT no mercado e adicione ao carrinho."
        action={
          <Link to="/" hash="catalogo" className={buttonVariants({ variant: 'default' })}>
            Explorar o mercado
          </Link>
        }
      />
    )
  } else {
    body = (
      <CartContent
        onRemoved={(name) => {
          setAnnouncement(`${name} removido do carrinho.`)
          // A lixeira desmontou com a linha: o foco vai para o título da página
          headingRef.current?.focus()
        }}
      />
    )
  }

  return (
    <div className={PAGE_CLASS}>
      {/*
        Celular (Figma mobile): sem o header do site e sem a tab bar (`staticData.hideMobileChrome` da rota), com o
        "Voltar" redondo e o título centralizado. A partir de `md`: a trilha "Início / Mercado / Carrinho", e o
        título fica só para leitores de tela (recebe o foco depois de remover uma linha).
      */}
      <header className="relative flex min-h-11 items-center justify-center md:block md:min-h-0">
        <MobileBackButton className="absolute left-0 md:hidden" />
        <CartBreadcrumb />
        <h1 ref={headingRef} tabIndex={-1} className="text-heading px-12 text-center outline-none md:sr-only">
          Carrinho de NFTs
        </h1>
      </header>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {body}
    </div>
  )
}

function CartContent({ onRemoved }: { onRemoved: (name: string) => void }) {
  const cart = useCart()
  const { account } = useSession()
  const accountId = account?.id
  const coupon = useCouponActions(cart)
  const issuesId = useId()
  const blockId = useId()

  const details = useQueries({ queries: cart.items.map((item) => nftDetailQuery(item.nftId)) })

  const cartForQuote: Cart = { items: [...cart.items], couponCode: cart.couponCode }
  const quote = useCartQuote(accountId, cartForQuote)
  const { quote: quoteData, recalculating, staleAfterError } = quote

  return (
    <div className={CART_GRID_CLASS}>
      <section aria-labelledby="carrinho-itens" className="flex min-w-0 flex-col gap-2">
        <h2 id="carrinho-itens" className="sr-only">
          Itens do carrinho
        </h2>
        {/* Cabeçalho visual da tabela; cada valor da linha tem o próprio rótulo para leitores de tela */}
        <div aria-hidden className={cn('border-border-soft text-body hidden border-b pb-2 font-bold md:grid', CART_COLUMNS_CLASS)}>
          <span className="col-span-2">NFTs</span>
          <span>Preço</span>
          <span>Edições</span>
          <span>Total</span>
        </div>
        <ul className="flex flex-col gap-4 md:gap-2">
          {cart.items.map((item, index) => {
            const detail = details[index]
            const nft = detail?.data
            return (
              <CartLine
                key={lineKey(item)}
                item={item}
                nft={nft}
                nftFailed={detail?.isError ?? false}
                unitPrice={quote.unitPriceOf(item) ?? nft?.price}
                issue={quote.issues.get(lineKey(item))}
                onQuantityChange={(quantity) => cart.setQuantity(item.nftId, item.edition, quantity)}
                onRemove={async () => {
                  await cart.remove(item.nftId, item.edition)
                  onRemoved(nft?.name ?? 'Item')
                }}
              />
            )
          })}
        </ul>
      </section>

      {/* "Resumo da carteira" é o texto do Figma; para leitores de tela o bloco continua "Resumo do pedido" */}
      <aside aria-label="Resumo do pedido" className={SUMMARY_PANEL_CLASS}>
        <h2 className={SUMMARY_TITLE_CLASS}>Resumo da carteira</h2>
        {cart.isAuthenticated ? (
          <>
            <CouponInput
              appearance="attached"
              status={couponStatus({
                submitting: coupon.submitting,
                couponCode: cart.couponCode,
                quote: quoteData,
                quoteError: quote.isError,
              })}
              appliedCode={quoteData?.coupon?.code ?? cart.couponCode}
              onApply={coupon.apply}
              onRemove={coupon.remove}
            />
            {quote.isError && !quoteData ? (
              <QuoteErrorState quote={quote} />
            ) : (
              <PriceSummary
                alwaysShowDiscount
                quote={quoteData}
                stale={recalculating || staleAfterError}
                staleMessage={
                  staleAfterError
                    ? 'Não foi possível atualizar a cotação. Tente de novo antes de continuar.'
                    : 'Recalculando os valores com a mudança no carrinho.'
                }
                staleAction={
                  staleAfterError ? (
                    <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => void quote.refetch()}>
                      Tentar novamente
                    </Button>
                  ) : undefined
                }
              />
            )}
            {quote.hasIssues && (
              <p id={issuesId} role="alert" className="text-destructive text-caption">
                {QUOTE_ISSUES_MESSAGE}
              </p>
            )}
            {quote.block === undefined ? (
              <Link to="/checkout" className={buttonVariants({ size: 'lg', className: CTA_CLASS })}>
                Conectar e finalizar
              </Link>
            ) : (
              <>
                {/* O motivo do bloqueio fica ligado ao botão; com `issues` é o próprio alerta acima */}
                <Button
                  type="button"
                  size="lg"
                  aria-disabled="true"
                  aria-busy={recalculating || undefined}
                  aria-describedby={quote.block === 'issues' ? issuesId : blockId}
                  className={cn(CTA_CLASS, BLOCKED_CTA_CLASS)}
                >
                  {recalculating && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
                  Conectar e finalizar
                </Button>
                {quote.block !== 'issues' && (
                  <p id={blockId} className="text-muted-foreground text-caption">
                    {CHECKOUT_BLOCK_MESSAGE[quote.block]}
                  </p>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-body">Entre para ver o total e aplicar cupons.</p>
            <Link to="/login" search={{ redirect: '/cart' }} className={buttonVariants({ size: 'lg', className: CTA_CLASS })}>
              Entrar para finalizar
            </Link>
          </>
        )}
        <ContinueExploring />
      </aside>
    </div>
  )
}

/** "Início / Mercado / Carrinho" em branco e negrito (Figma desktop). Só a partir de `md`. */
function CartBreadcrumb() {
  return (
    <Breadcrumb aria-label="Trilha de navegação" className="hidden md:block">
      <BreadcrumbList className="text-body text-foreground gap-2 font-bold sm:gap-2">
        <BreadcrumbItem>
          <BreadcrumbLink asChild className={CRUMB_CLASS}>
            <Link to="/">Início</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-foreground">/</BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbLink asChild className={CRUMB_CLASS}>
            <Link to="/" hash="catalogo">
              Mercado
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-foreground">/</BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbPage className="text-foreground font-bold">Carrinho</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function ContinueExploring() {
  return (
    <Link
      to="/"
      hash="catalogo"
      className="text-text-accent text-body focus-visible:ring-ring inline-flex min-h-11 items-center self-center rounded-sm px-2 underline-offset-4 outline-none hover:underline focus-visible:ring-3"
    >
      Continuar explorando
    </Link>
  )
}

/** Mesmas caixas do carrinho pronto (cabeçalho da tabela, linhas e o resumo com cupom), para não pular (§8, CLS). */
function CartSkeleton() {
  return (
    <div aria-busy className={CART_GRID_CLASS}>
      <div className="flex min-w-0 flex-col gap-2" aria-hidden>
        <div className={cn('border-border-soft hidden border-b pb-2 md:grid', CART_COLUMNS_CLASS)}>
          <Skeleton className="col-span-2 my-0.5 h-[17px] w-16" />
        </div>
        <div className="flex flex-col gap-4 md:gap-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={cn(
                'bg-card grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-3 overflow-hidden rounded-2xl md:rounded-none',
                CART_COLUMNS_CLASS,
              )}
            >
              <Skeleton className="aspect-square rounded-none" />
              <div className="flex flex-col gap-2 md:col-span-5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={SUMMARY_PANEL_CLASS} aria-hidden>
        <Skeleton className="h-[33px] w-48 max-md:hidden" />
        <Skeleton className="h-[67px] max-md:h-[75px]" />
        <PriceSummary loading alwaysShowDiscount />
        <Skeleton className={cn(CTA_CLASS, 'max-md:rounded-full')} />
        <Skeleton className="h-11 w-40 self-center" />
      </div>
      <p role="status" className="sr-only">
        Carregando o carrinho…
      </p>
    </div>
  )
}
