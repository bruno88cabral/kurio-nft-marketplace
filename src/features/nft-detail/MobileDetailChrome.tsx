import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Ban, ShoppingCart } from 'lucide-react'
import type { Nft } from '@/contracts'
import { OutOfScopeAction, PriceTag } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { isSoldOut } from '@/lib/editions'
import { cn } from '@/lib/utils'

/**
 * Header de tela do mobile (Figma `70397:240`): voltar + título. Voltar usa o histórico quando a
 * navegação começou dentro do app; num acesso direto (sem histórico) vai para o Início.
 * O badge de avaliação do Figma (`15:5690`) é omitido: o contrato não tem nota.
 */
export function MobileScreenHeader({ title, className }: { title: string; className?: string }) {
  const router = useRouter()
  const navigate = useNavigate()
  const canGoBack = useCanGoBack()
  return (
    <div data-slot="screen-header" className={cn('flex min-w-0 items-center gap-2 md:hidden', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Voltar"
        onClick={() => (canGoBack ? router.history.back() : void navigate({ to: '/' }))}
      >
        <ArrowLeft aria-hidden />
      </Button>
      <p aria-hidden className="text-body-lg min-w-0 truncate font-bold">
        {title}
      </p>
    </div>
  )
}

/**
 * Barra de compra do mobile (Figma `70396:245`): preço + ação. É `sticky` (não `fixed`) acima da
 * tab bar: gruda no rodapé da tela enquanto o Detalhe rola e, no fim da rota, volta ao fluxo,
 * então nunca cobre o fim do conteúdo nem o footer.
 */
export function MobilePurchaseBar({ nft, className }: { nft: Pick<Nft, 'price' | 'editions'>; className?: string }) {
  const soldOut = isSoldOut(nft.editions)
  return (
    <div
      data-slot="mobile-purchase-bar"
      className={cn(
        'border-border bg-background/95 sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex items-center justify-between gap-3 border-t px-4 py-3 backdrop-blur-sm md:hidden',
        className,
      )}
    >
      <PriceTag price={nft.price} size="md" className="min-w-0" />
      {soldOut ? (
        <Button type="button" disabled>
          <Ban aria-hidden />
          Esgotado
        </Button>
      ) : (
        <OutOfScopeAction variant="default" side="top">
          <ShoppingCart aria-hidden />
          Adicionar ao carrinho
        </OutOfScopeAction>
      )}
    </div>
  )
}
