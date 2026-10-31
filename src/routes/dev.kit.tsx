import { createFileRoute, notFound } from '@tanstack/react-router'
import { Share2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Id, NftEditionKind, Wallet } from '@/contracts'
import {
  AccountSidebar,
  CouponInput,
  EditionChips,
  EmptyState,
  ErrorState,
  FavoriteButton,
  FormField,
  NftCard,
  NftCardSkeleton,
  OutOfScopeAction,
  PriceSummary,
  PriceTag,
  QuantityStepper,
  WalletCard,
  WalletCardGroup,
  WalletOption,
  WalletOptionGroup,
  type NftCardProps,
} from '@/components/kurio'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { parseEth } from '@/lib/eth'
import type { WalletProvider } from '@/lib/wallets'

// Página de conferência do kit contra o Figma (390, 768 e 1440): só existe em dev, como /dev/tokens.
// Todos os dados abaixo são props literais da página; os componentes não buscam nada.
export const Route = createFileRoute('/dev/kit')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  head: () => ({ meta: [{ title: 'Kit · Kurio' }] }),
  component: KitPage,
})

const eth = parseEth

const cardNft: NftCardProps['nft'] = {
  id: 'nft-013',
  name: 'Atlas Zero',
  collection: 'Neon Atlas',
  imageUrl: '/nfts/atlas-zero.svg',
  price: eth('3.75'),
  editions: [{ kind: '1/1', available: 1, total: 1 }],
}

const soldOutNft: NftCardProps['nft'] = {
  id: 'nft-006',
  name: 'Cold Ember',
  collection: 'Aurora Drift',
  imageUrl: '/nfts/cold-ember.svg',
  price: eth('4.2'),
  editions: [{ kind: '1/1', available: 0, total: 1 }],
}

const walletPrimary: Wallet = {
  id: 'wallet-bruno-1',
  address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
  network: 'ethereum',
  role: 'primary',
  label: 'Principal',
}

const walletSecondary: Wallet = {
  id: 'wallet-bruno-2',
  address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  network: 'polygon',
  role: 'secondary',
  label: 'Reserva',
}

const quote = {
  subtotal: eth('0.7'),
  discount: eth('0'),
  networkFee: eth('0.002'),
  total: eth('0.702'),
}

const quoteWithCoupon = {
  subtotal: eth('0.7'),
  discount: eth('0.07'),
  networkFee: eth('0.002'),
  total: eth('0.632'),
  coupon: { code: 'KURIO10', status: 'applied' as const },
}

function KitPage() {
  const [favorited, setFavorited] = useState(false)
  const [edition, setEdition] = useState<NftEditionKind>('1/10')
  const [qty, setQty] = useState(1)
  const [qtyMax, setQtyMax] = useState(3)
  const [provider, setProvider] = useState<WalletProvider | undefined>('metamask')
  const [walletId, setWalletId] = useState<Id | undefined>(walletPrimary.id)
  const [couponStatus, setCouponStatus] = useState<'idle' | 'applying' | 'applied'>('idle')

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-heading">Kit de componentes</h1>
        <p className="text-muted-foreground text-caption">
          MYK-1059 · cada componente em todos os estados. Componentes em <code>src/components/kurio/</code>.
        </p>
      </header>

      <Section id="nft-card" title="NftCard">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <Labeled label="normal (com favorito)">
            <NftCard
              nft={cardNft}
              priority
              favorited={favorited}
              onFavoriteToggle={() => setFavorited((f) => !f)}
            />
          </Labeled>
          <Labeled label="preço riscado + selo">
            <NftCard nft={{ ...cardNft, id: 'nft-014', name: 'Meridian Glow', imageUrl: '/nfts/meridian-glow.svg', price: eth('0.95') }} previousPrice={eth('1.2')} badge="Raro" />
          </Labeled>
          <Labeled label="preço alterado (tempo real)">
            <NftCard nft={{ ...cardNft, id: 'nft-008', name: 'Tide Glitch', imageUrl: '/nfts/tide-glitch.svg', price: eth('0.24') }} previousPrice={eth('0.22')} priceChanged />
          </Labeled>
          <Labeled label="esgotado">
            <NftCard nft={soldOutNft} favorited onFavoriteToggle={() => undefined} />
          </Labeled>
          <Labeled label="skeleton">
            <NftCardSkeleton />
          </Labeled>
        </div>
        <div className="grid max-w-xl grid-cols-2 gap-4">
          <Labeled label="carrossel">
            <NftCard nft={{ ...cardNft, id: 'nft-020', name: 'Basalt Bloom', imageUrl: '/nfts/basalt-bloom.svg', price: eth('0.33') }} size="carousel" />
          </Labeled>
          <Labeled label="carrossel skeleton">
            <NftCardSkeleton size="carousel" />
          </Labeled>
        </div>
        <p className="text-muted-foreground text-caption">Hover/foco: passe o mouse ou use Tab nos cards acima.</p>
      </Section>

      <Section id="price-tag" title="PriceTag">
        <div className="flex flex-wrap items-end gap-8">
          <Labeled label="normal sm/md/lg">
            <div className="flex items-baseline gap-4">
              <PriceTag price={eth('0.125')} size="sm" />
              <PriceTag price={eth('0.125')} />
              <PriceTag price={eth('0.125')} size="lg" />
            </div>
          </Labeled>
          <Labeled label="com anterior riscado">
            <PriceTag price={eth('0.95')} previousPrice={eth('1.2')} />
          </Labeled>
          <Labeled label="alterado: subiu">
            <PriceTag price={eth('2.51')} previousPrice={eth('2.5')} changed size="lg" />
          </Labeled>
          <Labeled label="alterado: caiu">
            <PriceTag price={eth('0.3')} previousPrice={eth('0.35')} changed />
          </Labeled>
        </div>
      </Section>

      <Section id="edition-chips" title="EditionChips">
        <div className="flex flex-col gap-4">
          <Labeled label={`selecionado (${edition}) + indisponível (1/1 esgotada)`}>
            <EditionChips
              editions={[
                { kind: 'open', available: 640 },
                { kind: '1/1', available: 0 },
                { kind: '1/10', available: 6 },
                { kind: '1/50', available: 31 },
              ]}
              value={edition}
              onValueChange={setEdition}
            />
          </Labeled>
          <Labeled label="desabilitado">
            <EditionChips
              editions={[
                { kind: '1/10', available: 6 },
                { kind: 'open', available: 640 },
              ]}
              value="1/10"
              onValueChange={() => undefined}
              disabled
            />
          </Labeled>
        </div>
      </Section>

      <Section id="quantity-stepper" title="QuantityStepper">
        <div className="flex flex-wrap items-start gap-8">
          <Labeled label={`md, interativo (máx ${qtyMax})`}>
            <QuantityStepper value={qty} onChange={setQty} max={qtyMax} showLabel />
            <Button variant="link" size="xs" className="px-0" onClick={() => setQtyMax((m) => (m === 3 ? 10 : 3))}>
              alternar máximo
            </Button>
          </Labeled>
          <Labeled label="no mínimo">
            <QuantityStepper value={1} onChange={() => undefined} max={5} />
          </Labeled>
          <Labeled label="no máximo">
            <QuantityStepper value={5} onChange={() => undefined} max={5} />
          </Labeled>
          <Labeled label="sm (carrinho)">
            <QuantityStepper value={2} onChange={() => undefined} max={5} size="sm" />
          </Labeled>
          <Labeled label="desabilitado">
            <QuantityStepper value={2} onChange={() => undefined} max={5} disabled />
          </Labeled>
        </div>
      </Section>

      <Section id="price-summary" title="PriceSummary">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Labeled label="normal">
            <PriceSummary quote={quote} />
          </Labeled>
          <Labeled label="com cupom">
            <PriceSummary quote={quoteWithCoupon} />
          </Labeled>
          <Labeled label="desatualizado">
            <PriceSummary
              quote={quote}
              stale
              staleAction={
                <Button size="sm" variant="secondary" className="self-start">
                  Atualizar cotação
                </Button>
              }
            />
          </Labeled>
          <Labeled label="skeleton">
            <PriceSummary loading />
          </Labeled>
        </div>
      </Section>

      <Section id="coupon-input" title="CouponInput">
        <div className="grid gap-6 md:grid-cols-2">
          <Labeled label={`interativo (${couponStatus})`}>
            <CouponInput
              status={couponStatus}
              appliedCode="KURIO10"
              onApply={() => {
                setCouponStatus('applying')
                window.setTimeout(() => setCouponStatus('applied'), 800)
              }}
              onRemove={() => setCouponStatus('idle')}
            />
          </Labeled>
          <Labeled label="aplicando">
            <CouponInput status="applying" onApply={() => undefined} />
          </Labeled>
          <Labeled label="inválido">
            <CouponInput status="invalid" onApply={() => undefined} />
          </Labeled>
          <Labeled label="expirado">
            <CouponInput status="expired" onApply={() => undefined} />
          </Labeled>
          <Labeled label="aplicado">
            <CouponInput status="applied" appliedCode="KURIO10" onApply={() => undefined} onRemove={() => undefined} />
          </Labeled>
          <Labeled label="collapsible (Pagamento)">
            <CouponInput status="idle" collapsible onApply={() => undefined} />
          </Labeled>
        </div>
      </Section>

      <Section id="form-field" title="FormField">
        <div className="grid gap-6 md:grid-cols-2">
          <FormField label="Nome" required>
            {(p) => <Input {...p} placeholder="Seu nome" />}
          </FormField>
          <FormField label="E-mail" required error="Informe um e-mail válido.">
            {(p) => <Input {...p} type="email" defaultValue="ana@" />}
          </FormField>
          <FormField label="Endereço da carteira" apiError="Carteira já conectada.">
            {(p) => <Input {...p} defaultValue="0x8ba1f109551bD432803012645Ac136ddd64DBA72" />}
          </FormField>
          <FormField label="Rede" description="Rede em que a carteira opera.">
            {(p) => (
              <Select defaultValue="ethereum" disabled={p.disabled}>
                <SelectTrigger {...p} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethereum">Ethereum</SelectItem>
                  <SelectItem value="polygon">Polygon</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="Senha" hideLabel required>
            {(p) => <Input {...p} type="password" placeholder="Senha (rótulo só para leitor de tela)" />}
          </FormField>
          <FormField label="Apelido" disabled>
            {(p) => <Input {...p} defaultValue="Principal" />}
          </FormField>
        </div>
      </Section>

      <Section id="wallet-option" title="WalletOption">
        <div className="grid gap-6 md:grid-cols-2">
          <Labeled label={`selecionada (${provider ?? '—'})`}>
            <WalletOptionGroup value={provider} onValueChange={setProvider}>
              <WalletOption provider="walletconnect" />
              <WalletOption provider="metamask" />
              <WalletOption provider="coinbase" />
            </WalletOptionGroup>
          </Labeled>
          <Labeled label="conectando / recusada / desconectada">
            <WalletOptionGroup value="metamask" onValueChange={() => undefined} label="Carteira (estados)">
              <WalletOption provider="metamask" status="connecting" />
              <WalletOption provider="coinbase" status="rejected" />
              <WalletOption provider="walletconnect" status="disconnected" />
            </WalletOptionGroup>
          </Labeled>
        </div>
      </Section>

      <Section id="wallet-card" title="WalletCard">
        <Labeled label="selecionada / não selecionada / menu (abra o ⋮)">
          <WalletCardGroup value={walletId} onValueChange={setWalletId} className="max-w-md">
            <WalletCard
              wallet={walletPrimary}
              ens="bruno.eth"
              actions={[
                { label: 'Renomear', onSelect: () => undefined },
                { label: 'Ver no Etherscan', outOfScope: true },
                { label: 'Desconectar', destructive: true, onSelect: () => undefined },
              ]}
            />
            <WalletCard
              wallet={walletSecondary}
              actions={[
                { label: 'Tornar principal', onSelect: () => undefined },
                { label: 'Desconectar', destructive: true, onSelect: () => undefined },
              ]}
            />
          </WalletCardGroup>
        </Labeled>
      </Section>

      <Section id="account-sidebar" title="AccountSidebar">
        <div className="grid max-w-2xl gap-6 sm:grid-cols-2">
          <Labeled label="ativo: Dados do perfil">
            <AccountSidebar active="profile" onLogout={() => undefined} />
          </Labeled>
          <Labeled label="ativo: Carteiras">
            <AccountSidebar active="wallets" onLogout={() => undefined} loggingOut />
          </Labeled>
        </div>
      </Section>

      <Section id="out-of-scope" title="OutOfScopeAction e FavoriteButton">
        <div className="flex flex-wrap items-center gap-4">
          <OutOfScopeAction variant="link">Criadores</OutOfScopeAction>
          <OutOfScopeAction variant="link">Esqueceu a senha?</OutOfScopeAction>
          <OutOfScopeAction variant="outline">Entrar com Google</OutOfScopeAction>
          <OutOfScopeAction variant="outline" size="icon" label="Compartilhar">
            <Share2 aria-hidden />
          </OutOfScopeAction>
          <FavoriteButton variant="default" favorited={favorited} onToggle={() => setFavorited((f) => !f)} nftName="Atlas Zero" />
        </div>
      </Section>

      <Section id="states" title="EmptyState / ErrorState">
        <div className="grid gap-6 md:grid-cols-3">
          <EmptyState title="Você ainda não adicionou uma carteira secundária." />
          <EmptyState
            title="Nenhum NFT encontrado."
            description="Tente outros filtros ou limpe a busca."
            action={<Button variant="outline">Limpar filtros</Button>}
          />
          <ErrorState description="Verifique sua conexão." onRetry={() => undefined} />
          <ErrorState title="NFT indisponível." onRetry={() => undefined} retrying />
        </div>
      </Section>
    </main>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="text-body-lg border-border border-b pb-2 font-medium">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-muted-foreground text-tiny uppercase">{label}</span>
      {children}
    </div>
  )
}
