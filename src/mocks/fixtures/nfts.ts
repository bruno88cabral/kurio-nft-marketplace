import type { IsoDateTime, Network, Nft, NftEdition, NftEditionKind } from '@/contracts'
import { parseEth } from '@/lib/eth'
import { nftId } from '../db/ids'
import { COLLECTION_CREATORS, type CollectionName } from './collections'

/** Data de referência fixa do seed (nada de `Date.now()`); `createdAt` é relativo a ela. */
const REFERENCE_MS = Date.parse('2026-10-01T12:00:00.000Z')
const DAY_MS = 86_400_000

const EDITION_TOTAL: Record<NftEditionKind, number> = { '1/1': 1, '1/10': 10, '1/50': 50, open: 1_000 }

// [nome, coleção, rede, preço, edições [tipo, disponíveis][], featured, dias atrás]
type Row = [string, CollectionName, Network, string, Array<[NftEditionKind, number]>, boolean, number]

const ROWS: Row[] = [
  ['Aurora Prime', 'Aurora Drift', 'ethereum', '2.5', [['1/1', 1]], true, 3],
  ['Solar Veil', 'Aurora Drift', 'polygon', '0.35', [['1/10', 6], ['open', 640]], false, 12],
  ['Polar Hum', 'Aurora Drift', 'arbitrum', '0.8', [['1/50', 31]], false, 25],
  ['Glacial Pulse', 'Aurora Drift', 'optimism', '1.2', [['1/10', 0]], false, 40],
  ['Dawn Ribbon', 'Aurora Drift', 'ethereum', '0.15', [['open', 820]], false, 6],
  ['Cold Ember', 'Aurora Drift', 'polygon', '4.2', [['1/1', 0]], true, 90],

  ['Coral Byte', 'Pixel Reefs', 'polygon', '0.05', [['open', 950]], false, 2],
  ['Tide Glitch', 'Pixel Reefs', 'arbitrum', '0.22', [['1/50', 12], ['open', 300]], true, 8],
  ['Kelp Sprite', 'Pixel Reefs', 'optimism', '0.4', [['1/10', 3]], false, 18],
  ['Anemone 8-bit', 'Pixel Reefs', 'ethereum', '1.05', [['1/10', 10], ['1/50', 44]], false, 33],
  ['Deep Dither', 'Pixel Reefs', 'polygon', '0.09', [['open', 0]], false, 55],
  ['Reef Pulse', 'Pixel Reefs', 'arbitrum', '0.6', [['1/50', 50]], false, 1],

  ['Atlas Zero', 'Neon Atlas', 'ethereum', '3.75', [['1/1', 1]], true, 5],
  ['Meridian Glow', 'Neon Atlas', 'optimism', '0.95', [['1/10', 2]], false, 15],
  ['Tokyo Drift Map', 'Neon Atlas', 'arbitrum', '0.28', [['open', 410]], false, 21],
  ['Grid Lantern', 'Neon Atlas', 'polygon', '0.18', [['1/50', 27], ['open', 75]], false, 9],
  ['Night Compass', 'Neon Atlas', 'ethereum', '1.6', [['1/10', 0], ['1/50', 8]], false, 60],
  ['Signal Bloom', 'Neon Atlas', 'optimism', '0.07', [['open', 990]], false, 4],

  ['Onyx Fern', 'Obsidian Garden', 'ethereum', '2.1', [['1/1', 1]], false, 70],
  ['Basalt Bloom', 'Obsidian Garden', 'polygon', '0.33', [['1/10', 5]], true, 11],
  ['Shadow Moss', 'Obsidian Garden', 'arbitrum', '0.12', [['open', 700]], false, 30],
  ['Jet Orchid', 'Obsidian Garden', 'optimism', '0.75', [['1/50', 19]], false, 14],
  ['Slate Vine', 'Obsidian Garden', 'ethereum', '0.5', [['1/10', 7], ['open', 120]], false, 7],
  ['Coal Petal', 'Obsidian Garden', 'polygon', '5.0', [['1/1', 0]], false, 120],

  ['Origami Orbit', 'Paper Comets', 'arbitrum', '0.45', [['1/10', 9]], false, 10],
  ['Folded Tail', 'Paper Comets', 'ethereum', '0.2', [['open', 530]], false, 3],
  ['Crease Nova', 'Paper Comets', 'optimism', '1.35', [['1/50', 3]], true, 20],
  ['Vellum Streak', 'Paper Comets', 'polygon', '0.11', [['open', 0]], false, 45],
  ['Newsprint Halo', 'Paper Comets', 'ethereum', '0.65', [['1/10', 4], ['1/50', 38]], false, 2],
  ['Comet Mailer', 'Paper Comets', 'arbitrum', '0.03', [['open', 880]], false, 16],
]

/** Preço "de" (promoção) por nome; sempre maior que o preço atual da linha. */
const PREVIOUS_PRICE: Record<string, string> = {
  'Solar Veil': '0.5',
  'Kelp Sprite': '0.55',
  'Meridian Glow': '1.2',
  'Slate Vine': '0.7',
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function createdAt(daysAgo: number): IsoDateTime {
  return new Date(REFERENCE_MS - daysAgo * DAY_MS).toISOString()
}

export const NFTS: readonly Nft[] = ROWS.map(([name, collection, network, price, editions, featured, daysAgo], index): Nft => {
  // Uma arte por NFT (o manifest de `src/lib/nftArt.ts` só tem a capa); a galeria cresce quando houver variações
  const imageUrl = `/nfts/${slug(name)}.svg`
  const previousPrice = PREVIOUS_PRICE[name]
  return {
    id: nftId(index + 1),
    name,
    imageUrl,
    images: [imageUrl],
    collection,
    description: `${name}, da coleção ${collection}. Arte digital fictícia para o marketplace Kurio.`,
    creator: COLLECTION_CREATORS[collection],
    network,
    price: parseEth(price),
    ...(previousPrice !== undefined && { previousPrice: parseEth(previousPrice) }),
    editions: editions.map(
      ([kind, available]): NftEdition => ({ kind, available, total: EDITION_TOTAL[kind] }),
    ),
    createdAt: createdAt(daysAgo),
    featured,
  }
})
