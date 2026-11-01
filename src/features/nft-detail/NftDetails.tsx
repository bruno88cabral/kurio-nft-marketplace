import type { Nft } from '@/contracts'
import { OutOfScopeAction } from '@/components/kurio'
import { editionLabel, sortEditions } from '@/lib/editions'
import { networkLabel } from '@/lib/wallets'
import { cn } from '@/lib/utils'

/** Aba do Figma: branca; a ativa laranja e em negrito, com sublinhado laranja sobre a linha. */
const tab = 'text-body-lg -mb-px flex h-11 items-center border-b-2 border-transparent px-0 whitespace-nowrap'

/**
 * "Detalhes do NFT" / "Avaliações de colecionadores" (Figma desktop). Só há conteúdo para a
 * primeira, então ela é o título da seção com cara de aba ativa (uma `tablist` de uma aba só
 * não ajudaria ninguém), e "Avaliações" é `OutOfScopeAction` ("Em breve"): o contrato não tem
 * avaliações, nem a contagem "(19)". O conteúdo é o que o contrato tem: rede e edições.
 */
export function NftDetails({ nft, className }: { nft: Pick<Nft, 'network' | 'editions'>; className?: string }) {
  return (
    <section aria-labelledby="nft-detalhes" className={cn('flex flex-col gap-4', className)}>
      <div className="border-border-soft flex items-end gap-6 overflow-x-auto border-b md:gap-10">
        <h2 id="nft-detalhes" className={cn(tab, 'border-text-accent text-text-accent font-bold')}>
          Detalhes do NFT
        </h2>
        <OutOfScopeAction variant="ghost" className={cn(tab, 'text-foreground rounded-none font-normal opacity-100 hover:bg-transparent')}>
          Avaliações de colecionadores
        </OutOfScopeAction>
      </div>
      <dl className="text-body flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <dt className="font-bold">Rede:</dt>
          <dd className="text-muted-foreground">{networkLabel(nft.network)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-bold">Edições:</dt>
          <dd className="text-muted-foreground">
            <ul className="flex flex-col gap-1">
              {sortEditions(nft.editions).map((e) => (
                <li key={e.kind}>
                  {editionLabel(e.kind)}: {e.available > 0 ? `${e.available} de ${e.total} disponíveis` : 'esgotada'}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </section>
  )
}
