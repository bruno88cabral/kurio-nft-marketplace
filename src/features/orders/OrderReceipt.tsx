import { ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Id, Nft, Order } from '@/contracts'
import { buttonVariants } from '@/components/ui/button'
import { editionLabel } from '@/lib/editions'
import { cmpEth, formatEthLabel, mulEth, parseEth } from '@/lib/eth'
import { nftArtSize } from '@/lib/nftArt'
import { cn } from '@/lib/utils'
import { networkLabel, shortAddress } from '@/lib/wallets'

const ZERO = parseEth('0')
/** Colunas da tabela de itens: arte, NFT, Edições ("(x N)") e Subtotal; no celular, "(x N)" e o subtotal empilham. */
const ITEM_GRID_CLASS =
  'grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[5.25rem_minmax(0,1fr)_4.5rem_7rem] sm:gap-x-4'

/** "29 jul. 2026" (Figma), no fuso de quem vê. */
function formatOrderDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(new Date(iso))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('day')} ${part('month')} ${part('year')}`
}

export interface OrderReceiptProps {
  order: Order
  /**
   * Arte de cada NFT do pedido (`nftDetailQuery` por `nftId`). A imagem não é valor: nome, edição, quantidade e
   * preços vêm só do `order.receipt`. Sem a arte (carregando ou falhou), fica um bloco do mesmo tamanho.
   */
  nfts?: Partial<Record<Id, Nft>>
  /**
   * Carteira do pedido, de `GET /wallets`: o apelido ou, sem apelido, o endereço abreviado. Sem ela (removida
   * depois do pedido, ou a lista falhou), a faixa mostra um traço: o pedido só guarda o id da carteira.
   */
  walletLabel?: string
}

/**
 * Recibo do pedido confirmado (Figma "Confirmação de Pedido"): faixa de metadados (transação, data, total e
 * carteira), "Detalhes da transação" com a tabela "NFTs | Edições | Subtotal", taxa de rede e total, o texto da
 * rede e "Ver no Etherscan". Todo valor vem do `order.receipt` (snapshot do que foi cobrado), nunca do catálogo
 * atual: mudar o preço do NFT depois não muda o recibo. O subtotal de cada linha é `mulEth(unitPrice, quantity)`,
 * só para exibir; nada é somado entre linhas.
 */
export function OrderReceipt({ order, nfts = {}, walletLabel }: OrderReceiptProps) {
  const { receipt } = order
  const network = networkLabel(order.network)
  return (
    <div className="flex flex-col">
      <dl className="border-primary text-caption grid grid-cols-2 border-y sm:grid-cols-[auto_auto_auto_auto] sm:justify-between">
        <Meta label="ID da transação" className="max-sm:border-primary max-sm:border-r max-sm:border-b">
          {order.txHash ? <span title={order.txHash}>{shortAddress(order.txHash)}</span> : '—'}
        </Meta>
        <Meta label="Data" className="max-sm:border-primary max-sm:border-b sm:border-primary sm:border-l">
          {formatOrderDate(order.createdAt)}
        </Meta>
        <Meta label="Total" className="max-sm:border-primary max-sm:border-r sm:border-primary sm:border-l">
          {formatEthLabel(receipt.total)}
        </Meta>
        <Meta label="Carteira" className="sm:border-primary sm:border-l">
          {walletLabel ?? '—'}
        </Meta>
      </dl>

      <section aria-labelledby="detalhes-da-transacao" className="flex flex-col gap-3 px-4 pt-6 sm:px-12">
        <h2 id="detalhes-da-transacao" className="text-body font-bold">
          Detalhes da transação
        </h2>
        {/* Cabeçalho visual; cada valor da linha tem o próprio rótulo para leitores de tela */}
        <div aria-hidden className={cn(ITEM_GRID_CLASS, 'border-border-soft text-body border-b pb-2 font-bold')}>
          <span className="col-span-2">NFTs</span>
          <span className="max-sm:hidden">Edições</span>
          <span className="text-right max-sm:hidden">Subtotal</span>
          <span className="text-right sm:hidden">Subtotal</span>
        </div>
        <ul className="flex flex-col gap-3">
          {receipt.items.map((item) => {
            const nft = nfts[item.nftId]
            const art = nft ? nftArtSize(nft.imageUrl) : undefined
            return (
              <li key={`${item.nftId}:${item.edition}`} className={ITEM_GRID_CLASS}>
                <div className="bg-muted aspect-square overflow-hidden rounded-md">
                  {nft && art && (
                    <img
                      src={nft.imageUrl}
                      alt=""
                      width={art.width}
                      height={art.height}
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                    />
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-body truncate font-bold">{item.name}</p>
                  <p className="text-muted-foreground text-caption">Edição: {editionLabel(item.edition)}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 sm:contents">
                  <p className="text-muted-foreground text-caption sm:text-body">
                    <span className="sr-only">Quantidade: </span>(x {item.quantity})
                  </p>
                  <p className="text-text-accent text-body font-bold tabular-nums sm:text-right">
                    <span className="sr-only">Subtotal: </span>
                    {formatEthLabel(mulEth(item.unitPrice, item.quantity))}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
        <dl className="text-body ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1">
          {cmpEth(receipt.discount, ZERO) > 0 && (
            <>
              <dt>Desconto</dt>
              <dd className="text-right tabular-nums">(-) {formatEthLabel(receipt.discount)}</dd>
            </>
          )}
          <dt>Taxa de rede</dt>
          <dd className="text-right tabular-nums">{formatEthLabel(receipt.networkFee)}</dd>
          <dt className="font-bold">Total</dt>
          <dd className="text-text-accent text-body-lg text-right font-bold tabular-nums">{formatEthLabel(receipt.total)}</dd>
        </dl>
      </section>

      <div className="border-border-soft mx-4 mt-3 flex flex-col items-center gap-5 border-t pt-4 text-center sm:mx-12">
        <p className="text-muted-foreground text-caption leading-relaxed">
          Transação confirmada na {network}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
        </p>
        {order.explorerUrl && (
          <a
            href={order.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: 'lg', className: 'text-body font-bold' })}
          >
            {order.network === 'ethereum' ? 'Ver no Etherscan' : 'Ver no explorador'}
            <ExternalLink aria-hidden className="size-4" />
            <span className="sr-only">(abre em nova aba)</span>
          </a>
        )}
      </div>
    </div>
  )
}

function Meta({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5 px-4 py-3 sm:px-5', className)}>
      <dt className="text-text-accent font-bold">{label}</dt>
      <dd className="text-muted-foreground truncate tabular-nums">{children}</dd>
    </div>
  )
}
