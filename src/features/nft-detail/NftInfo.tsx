import { Link } from '@tanstack/react-router'
import type { Nft } from '@/contracts'
import { PriceTag } from '@/components/kurio'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { cn } from '@/lib/utils'

const crumb =
  'text-foreground hover:text-text-accent text-body focus-visible:ring-ring inline-flex min-h-11 items-center rounded-sm font-bold outline-none focus-visible:ring-3 lg:min-h-0'

/** "Início / Mercado" em branco e negrito (Figma desktop). Só a partir de `md`. */
export function NftBreadcrumb({ className }: { className?: string }) {
  return (
    <Breadcrumb aria-label="Trilha de navegação" className={className}>
      <BreadcrumbList className="gap-2 sm:gap-2">
        <BreadcrumbItem>
          <BreadcrumbLink asChild className={crumb}>
            <Link to="/">Início</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-foreground text-body font-bold">/</BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbLink asChild className={crumb}>
            <Link to="/" hash="catalogo">
              Mercado
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

/**
 * Nome (`h1`) e preço em laranja (Figma). No desktop o preço fica logo abaixo do nome, sobre uma
 * linha divisória; no mobile ele vai para a barra de compra (`MobilePurchaseBar`), e aqui fica só
 * o nome. O preço só é anunciado (`live`) onde está visível: as duas cópias nunca aparecem juntas.
 */
export function NftInfo({ nft, className }: { nft: Pick<Nft, 'name' | 'price' | 'previousPrice'>; className?: string }) {
  return (
    <div data-slot="nft-info" className={cn('flex min-w-0 flex-col gap-1 md:border-border-soft md:border-b md:pb-3', className)}>
      <h1 className="text-heading break-words lg:text-[1.75rem]">{nft.name}</h1>
      <PriceTag
        price={nft.price}
        previousPrice={nft.previousPrice}
        size="lg"
        tone="accent"
        live
        className="hidden md:inline-flex"
      />
    </div>
  )
}

/** "Sobre este NFT:" e a descrição em marrom. No mobile o título fica só para o leitor de tela (Figma). */
export function NftDescription({ description, className }: { description: string; className?: string }) {
  return (
    <section aria-labelledby="nft-descricao" className={cn('flex flex-col gap-2', className)}>
      <h2 id="nft-descricao" className="text-body font-bold max-md:sr-only">
        Sobre este NFT:
      </h2>
      <p className="text-muted-foreground text-body leading-relaxed whitespace-pre-line">{description}</p>
    </section>
  )
}

/** "Coleção: …" e "Criador: …" em marrom (Figma: a lista abaixo da compra). */
export function NftFacts({ nft, className }: { nft: Pick<Nft, 'collection' | 'creator'>; className?: string }) {
  const facts = [
    ['Coleção', nft.collection],
    ['Criador', nft.creator],
  ] as const
  return (
    <dl className={cn('text-muted-foreground text-body flex flex-col gap-2', className)}>
      {facts.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-wrap gap-x-2">
          <dt>{label}:</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
