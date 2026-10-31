import { Link } from '@tanstack/react-router'
import type { Nft } from '@/contracts'
import { PriceTag } from '@/components/kurio'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { withFilter } from '@/lib/catalogSearch'
import { networkLabel } from '@/lib/wallets'
import { cn } from '@/lib/utils'

type InfoNft = Pick<Nft, 'name' | 'collection' | 'creator' | 'network' | 'price' | 'previousPrice' | 'description'>

/** Início › coleção (catálogo filtrado) › nome (Figma `10:290`). Só no desktop/tablet. */
export function NftBreadcrumb({ nft, className }: { nft: Pick<Nft, 'name' | 'collection'>; className?: string }) {
  return (
    <Breadcrumb aria-label="Trilha de navegação" className={className}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">Início</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/" search={withFilter({}, { collections: [nft.collection] })} hash="catalogo">
              {nft.collection}
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate">{nft.name}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

/** Coleção, nome (`h1`), criador, rede e preço com o preço anterior riscado. */
export function NftInfo({ nft, className }: { nft: InfoNft; className?: string }) {
  return (
    <div data-slot="nft-info" className={cn('flex min-w-0 flex-col gap-3', className)}>
      <p className="text-muted-foreground text-caption uppercase">{nft.collection}</p>
      <h1 className="text-heading lg:text-display break-words">{nft.name}</h1>
      <dl className="text-caption grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Criador</dt>
        <dd className="min-w-0 truncate">{nft.creator}</dd>
        <dt className="text-muted-foreground">Rede</dt>
        <dd>{networkLabel(nft.network)}</dd>
      </dl>
      <PriceTag price={nft.price} previousPrice={nft.previousPrice} size="lg" live />
    </div>
  )
}

/** Descrição do NFT (seção própria, abaixo da área de compra). */
export function NftDescription({ description, className }: { description: string; className?: string }) {
  return (
    <section aria-labelledby="nft-descricao" className={cn('flex flex-col gap-2', className)}>
      <h2 id="nft-descricao" className="text-body-lg font-bold">
        Descrição
      </h2>
      <p className="text-muted-foreground text-body whitespace-pre-line">{description}</p>
    </section>
  )
}
