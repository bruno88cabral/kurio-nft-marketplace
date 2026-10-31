import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { LoaderCircle, ShoppingCart } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { nftDetailQuery } from '@/api/nfts'
import { quoteQuery } from '@/api/quotes'
import { useSession } from '@/auth/useSession'
import { useQueryInvalidated } from '@/realtime/useQueryInvalidated'
import type { Cart } from '@/contracts'
import { CouponInput, EmptyState, ErrorState, PriceSummary } from '@/components/kurio'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CartLine } from './CartLine'
import { canCheckout as checkoutAllowed, couponStatus, issuesByLine, lineKey } from './cartView'
import { useCart } from './useCart'

export const COUPON_FAILURE_MESSAGE = 'Não foi possível atualizar o cupom.'
const PAGE_CLASS = 'mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-4 pb-8 md:px-6 md:py-8'
/** `ui/button` só estiliza `disabled:`; o CTA bloqueado usa `aria-disabled` (foco preservado), então estiliza aqui. */
const BLOCKED_CTA_CLASS =
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-primary aria-disabled:active:translate-y-0'
const GRID_CLASS = 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10'

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
  const [couponSubmitting, setCouponSubmitting] = useState(false)

  const details = useQueries({ queries: cart.items.map((item) => nftDetailQuery(item.nftId)) })

  const cartForQuote: Cart = { items: [...cart.items], couponCode: cart.couponCode }
  const quoteOptions = quoteQuery(accountId ?? '', cartForQuote)
  const quote = useQuery({
    ...quoteOptions,
    enabled: accountId !== undefined && cart.items.length > 0,
    // Recotando (chave nova): segue mostrando a cotação anterior, marcada como desatualizada
    placeholderData: keepPreviousData,
  })
  // Mesma chave invalidada (ex.: `nft.updated` de um item do carrinho, MYK-1091): também é recotar
  const invalidated = useQueryInvalidated(quoteOptions.queryKey)
  const quoteData = quote.data
  const issues = issuesByLine(quoteData?.issues)
  const recalculating = quote.isPlaceholderData || (invalidated && quote.isFetching)

  const applyCoupon = async (code: string) => {
    setCouponSubmitting(true)
    try {
      await cart.applyCoupon(code)
    } catch {
      toast.error(COUPON_FAILURE_MESSAGE)
    } finally {
      setCouponSubmitting(false)
    }
  }
  const removeCoupon = async () => {
    setCouponSubmitting(true)
    try {
      await cart.removeCoupon()
    } catch {
      toast.error(COUPON_FAILURE_MESSAGE)
    } finally {
      setCouponSubmitting(false)
    }
  }

  const canCheckout = checkoutAllowed({ quote: quoteData, recalculating, quoteError: quote.isError })
  // Recotação falhou mas há cotação antiga (que vai vencer): mostra-a como desatualizada, com retry
  const staleAfterError = quote.isError && quoteData !== undefined

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
            const quoted = quoteData?.items.find((q) => q.nftId === item.nftId && q.edition === item.edition)
            return (
              <CartLine
                key={lineKey(item)}
                item={item}
                nft={nft}
                nftFailed={detail?.isError ?? false}
                unitPrice={quoted?.unitPrice ?? nft?.price}
                issue={issues.get(lineKey(item))}
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
                submitting: couponSubmitting,
                couponCode: cart.couponCode,
                quote: quoteData,
                quoteError: quote.isError,
              })}
              appliedCode={quoteData?.coupon?.code ?? cart.couponCode}
              onApply={(code) => void applyCoupon(code)}
              onRemove={() => void removeCoupon()}
            />
            {quote.isError && !quoteData ? (
              <ErrorState
                title="Não foi possível calcular o total."
                onRetry={() => void quote.refetch()}
                retrying={quote.isFetching}
                className="px-3 py-6"
              />
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
            {(quoteData?.issues?.length ?? 0) > 0 && (
              <p role="alert" className="text-destructive text-caption">
                Há itens indisponíveis ou com preço alterado. Ajuste o carrinho para continuar.
              </p>
            )}
            {canCheckout ? (
              <Link to="/checkout" className={buttonVariants({ size: 'lg' })}>
                Ir para o pagamento
              </Link>
            ) : (
              <Button type="button" size="lg" aria-disabled="true" aria-busy={recalculating || undefined} className={BLOCKED_CTA_CLASS}>
                {recalculating && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
                Ir para o pagamento
              </Button>
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
          <div key={i} className="flex gap-4">
            <Skeleton className="size-24 rounded-lg motion-reduce:animate-none" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-48 motion-reduce:animate-none" />
              <Skeleton className="h-4 w-24 motion-reduce:animate-none" />
              <Skeleton className="h-6 w-28 motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton aria-hidden className="h-56 rounded-lg motion-reduce:animate-none" />
      <p role="status" className="sr-only">
        Carregando o carrinho…
      </p>
    </div>
  )
}
