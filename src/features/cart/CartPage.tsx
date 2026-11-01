import { useQueries } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { LoaderCircle, ShoppingCart } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { nftDetailQuery } from '@/api/nfts'
import { useSession } from '@/auth/useSession'
import type { Cart } from '@/contracts'
import { CouponInput, EmptyState, ErrorState, PriceSummary } from '@/components/kurio'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CartLine } from './CartLine'
import { CHECKOUT_BLOCK_MESSAGE, couponStatus, lineKey } from './cartView'
import { BLOCKED_CTA_CLASS, GRID_CLASS, PAGE_CLASS } from './layout'
import { QuoteErrorState } from './QuoteErrorState'
import { QUOTE_ISSUES_MESSAGE, useCartQuote } from './useCartQuote'
import { useCart } from './useCart'
import { useCouponActions } from './useCouponActions'

/**
 * Carrinho (`/cart`, rota pública). Visitante: linhas com o preço do catálogo, sem total nem cupom, com o
 * convite para entrar. Logado: resumo da cotação (`POST /quotes`), cupom e "Ir para o pagamento".
 * Nenhum total é calculado aqui: todo valor do resumo vem da cotação. O `<main>` é o do root.
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
          // O botão "Remover" desmontou com a linha: o foco vai para o título da página
          headingRef.current?.focus()
        }}
      />
    )
  }

  return (
    <div className={PAGE_CLASS}>
      <header className="flex flex-wrap items-baseline gap-x-3">
        <h1 ref={headingRef} tabIndex={-1} className="text-heading outline-none">
          Carrinho
        </h1>
        {!cart.isPending && !cart.isError && cart.totalQuantity > 0 && (
          <p className="text-muted-foreground text-body">
            {cart.totalQuantity} {cart.totalQuantity === 1 ? 'item' : 'itens'}
          </p>
        )}
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
    <div className={GRID_CLASS}>
      <section aria-labelledby="carrinho-itens" className="min-w-0">
        <h2 id="carrinho-itens" className="sr-only">
          Itens do carrinho
        </h2>
        <ul className="flex flex-col">
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

      <aside aria-label="Resumo do pedido" className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4 lg:sticky lg:top-24">
        {cart.isAuthenticated ? (
          <>
            <CouponInput
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
                title="Resumo"
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
              <Link to="/checkout" className={buttonVariants({ size: 'lg' })}>
                Ir para o pagamento
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
                  className={BLOCKED_CTA_CLASS}
                >
                  {recalculating && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
                  Ir para o pagamento
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
            <h2 className="text-body-lg font-medium">Resumo</h2>
            <p className="text-muted-foreground text-body">Entre para ver o total e aplicar cupons.</p>
            <Link to="/login" search={{ redirect: '/cart' }} className={buttonVariants({ size: 'lg' })}>
              Entrar para finalizar
            </Link>
          </>
        )}
      </aside>
    </div>
  )
}

function CartSkeleton() {
  return (
    <div aria-busy className={GRID_CLASS}>
      <div className="flex flex-col gap-4" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3 py-4 first:pt-0 sm:gap-4">
            <Skeleton className="size-20 shrink-0 rounded-lg sm:size-24" />
            <div className="flex min-h-[97px] flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-28" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton aria-hidden className="h-[319px] rounded-lg" />
      <p role="status" className="sr-only">
        Carregando o carrinho…
      </p>
    </div>
  )
}
