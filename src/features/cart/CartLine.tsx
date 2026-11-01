import { Link } from '@tanstack/react-router'
import { CircleAlert, LoaderCircle, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { ApiError, type CartItem, type EthAmount, type Nft, type QuoteIssue } from '@/contracts'
import { QuantityStepper } from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { editionLabel } from '@/lib/editions'
import { formatEthLabel, mulEth } from '@/lib/eth'
import { nftArtSize } from '@/lib/nftArt'
import { cn } from '@/lib/utils'
import { CART_COLUMNS_CLASS } from './layout'

export const LINE_FAILURE_MESSAGE = 'Não foi possível atualizar o carrinho.'

const ISSUE_LABEL: Record<QuoteIssue['kind'], string> = {
  unavailable: 'Indisponível',
  price_changed: 'Preço alterado',
}

export interface CartLineProps {
  item: CartItem
  /** Detalhe do NFT; `undefined` enquanto carrega ou se a busca falhou (`nftFailed`). */
  nft: Nft | undefined
  nftFailed?: boolean
  /**
   * Preço unitário a mostrar: o da cotação quando há (logado), senão o do catálogo. O total da linha é
   * `mulEth(unitPrice, quantity)`, só para exibir; nada é somado entre linhas.
   */
  unitPrice: EthAmount | undefined
  issue?: QuoteIssue['kind']
  onQuantityChange: (quantity: number) => Promise<void>
  onRemove: () => Promise<void>
}

/**
 * Linha do carrinho (Figma): arte, nome (link para o Detalhe com a edição), edição, preço unitário (a partir de
 * `md`), stepper (1..`available`), total da linha e a lixeira só com ícone. O envio trava só esta linha
 * (`aria-busy`); o 409 de estoque aparece nela (`role="alert"`), abaixo do nome.
 */
export function CartLine({ item, nft, nftFailed = false, unitPrice, issue, onQuantityChange, onRemove }: CartLineProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? e.message : LINE_FAILURE_MESSAGE)
    } finally {
      setBusy(false)
    }
  }

  const available = nft?.editions.find((e) => e.kind === item.edition)?.available
  const name = nft?.name ?? (nftFailed ? 'NFT indisponível' : undefined)
  const art = nft ? nftArtSize(nft.imageUrl) : undefined
  const editionText = `Edição ${editionLabel(item.edition)}`

  return (
    <li
      data-slot="cart-line"
      aria-busy={busy || undefined}
      className={cn(
        // Celular (Figma mobile): card arredondado com a arte à esquerda (~⅓), nome, edição e o total em laranja,
        // o stepper à direita e a lixeira no canto. A partir de `md`: a faixa da tabela (Figma desktop).
        'bg-card relative grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-x-3 overflow-hidden rounded-2xl md:rounded-none',
        CART_COLUMNS_CLASS,
        busy && 'opacity-70',
      )}
    >
      {/* Com aviso, a faixa do desktop ganha uma segunda linha (abaixo do nome), que a arte não ocupa */}
      <div className="bg-muted row-span-3 aspect-square self-start overflow-hidden rounded-2xl md:row-span-1 md:rounded-none">
        {nft && art ? (
          <img
            src={nft.imageUrl}
            alt=""
            width={art.width}
            height={art.height}
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : nftFailed ? null : (
          <Skeleton className="size-full" />
        )}
      </div>

      <div className="col-span-2 flex min-w-0 flex-col gap-0.5 self-end pt-3 pr-12 md:col-span-1 md:self-center md:py-3 md:pr-0">
        {nft ? (
          <Link
            to="/nfts/$nftId"
            params={{ nftId: nft.id }}
            search={{ edition: item.edition }}
            className="text-body-lg md:text-body hover:text-text-accent focus-visible:ring-ring truncate rounded-sm font-bold outline-none focus-visible:ring-3"
          >
            {nft.name}
          </Link>
        ) : name ? (
          <p className="text-body-lg md:text-body font-bold">{name}</p>
        ) : (
          <Skeleton className="h-5 w-40" />
        )}
        <p className="text-muted-foreground text-caption">Edição: {editionLabel(item.edition)}</p>
      </div>

      <div className="hidden md:block">
        {unitPrice ? (
          <span className="text-body font-bold tabular-nums">
            <span className="sr-only">Preço unitário: </span>
            {formatEthLabel(unitPrice)}
          </span>
        ) : (
          <Skeleton className="h-4 w-16" />
        )}
      </div>

      <QuantityStepper
        appearance="cart"
        value={item.quantity}
        onChange={(quantity) => void run(() => onQuantityChange(quantity))}
        min={1}
        max={available ?? item.quantity}
        // Sem `disabled` durante o envio: o foco não pode sumir do campo; `run` ignora o segundo envio
        disabled={available === undefined}
        label={name ? `Quantidade de ${name}, ${editionText}` : 'Quantidade'}
        className="col-start-3 row-start-2 items-end self-center pr-2 md:col-start-auto md:row-start-auto md:items-start md:pr-0"
      />

      {/* Total da linha: `mulEth(unitPrice, quantity)`, só para exibir (decisão do humano); nada é somado entre linhas */}
      <div className="col-start-2 row-start-2 min-w-0 self-center md:col-start-auto md:row-start-auto">
        {unitPrice ? (
          <span className="text-text-accent md:text-body text-xl font-bold whitespace-nowrap tabular-nums">
            <span className="sr-only">Total da linha: </span>
            {formatEthLabel(mulEth(unitPrice, item.quantity))}
          </span>
        ) : (
          <Skeleton className="h-6 w-20 md:h-4 md:w-16" />
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remover ${name ?? 'item'}, ${editionText}`}
        aria-disabled={busy || undefined}
        onClick={() => void run(onRemove)}
        className="text-text-accent/70 hover:text-text-accent absolute top-1 right-1 size-11 rounded-full md:static"
      >
        {busy ? (
          <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
        ) : (
          <Trash2 aria-hidden className="size-5" />
        )}
      </Button>

      {(issue || error) && (
        <div className="col-span-2 col-start-2 row-start-3 flex flex-col gap-1 pb-3 md:col-span-5 md:col-start-2 md:row-start-2 md:-mt-2">
          {issue && (
            <p className="text-destructive text-caption inline-flex items-center gap-1.5 font-medium">
              <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
              {ISSUE_LABEL[issue]}
              {issue === 'unavailable' && <span className="text-muted-foreground font-normal">· sem estoque suficiente</span>}
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive text-caption inline-flex items-center gap-1.5">
              <CircleAlert aria-hidden className="size-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  )
}
