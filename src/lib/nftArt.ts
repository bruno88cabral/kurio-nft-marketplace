/**
 * Manifest das artes de `public/nfts/`: caminho público → dimensões intrínsecas.
 * Componentes passam `width`/`height` para o `<img>` reservar o espaço (CLS, risco R2).
 *
 * As artes são as 4 fotos dos macacos exportadas do Figma e convertidas por
 * `scripts/optimize-nft-art.mjs` (MYK-1079): recorte 1:1, larguras 320 e 960, AVIF e WebP.
 * O `<img>` usa o WebP de 960 (`NFT_ARTS[n].src`); o AVIF e o 320 ficam registrados para o
 * `<picture>` com `srcset` (MYK-1116). Ver ARCHITECTURE.md, "Substituição de assets".
 * `nftArt.test.ts` confere este manifest contra os arquivos do disco e as fixtures do mock.
 */
export interface NftArt {
  width: number
  height: number
}

/** Uma arte em todos os tamanhos e formatos gerados. */
export interface NftArtSet {
  slug: string
  /** Fallback do `<img>` e valor de `Nft.imageUrl`: WebP de 960. */
  src: string
  /** Larguras disponíveis → caminho por formato. */
  variants: Readonly<Record<NftArtWidth, Readonly<Record<NftArtFormat, string>>>>
}

export type NftArtWidth = 320 | 960
export type NftArtFormat = 'avif' | 'webp'

export const NFT_ART_WIDTHS: readonly NftArtWidth[] = [320, 960]
const FORMATS: readonly NftArtFormat[] = ['avif', 'webp']

/** As 4 artes, na ordem da regra de distribuição das fixtures (`src/mocks/fixtures/nfts.ts`). */
export const NFT_ART_SLUGS = ['macaco-oculos', 'macaco-chapeu', 'macaco-gola-alta', 'macaco-fones'] as const

function artSet(slug: string): NftArtSet {
  const path = (width: NftArtWidth, format: NftArtFormat) => `/nfts/${slug}-${width}.${format}`
  return {
    slug,
    src: path(960, 'webp'),
    variants: {
      320: { avif: path(320, 'avif'), webp: path(320, 'webp') },
      960: { avif: path(960, 'avif'), webp: path(960, 'webp') },
    },
  }
}

export const NFT_ARTS: readonly NftArtSet[] = NFT_ART_SLUGS.map(artSet)

/** SVGs placeholder do M1 que ainda são usadas fora do seed (`/dev/kit`); `viewBox` 120x120. */
const LEGACY_SVGS = ['atlas-zero', 'basalt-bloom', 'cold-ember', 'meridian-glow', 'tide-glitch']

const MANIFEST_ENTRIES: Array<[string, NftArt]> = [
  // Os originais são 1000x1000 e não há upscale: cada largura gera um quadrado do mesmo lado
  ...NFT_ARTS.flatMap((art) =>
    NFT_ART_WIDTHS.flatMap((width) =>
      FORMATS.map((format): [string, NftArt] => [art.variants[width][format], { width, height: width }]),
    ),
  ),
  ...LEGACY_SVGS.map((slug): [string, NftArt] => [`/nfts/${slug}.svg`, { width: 120, height: 120 }]),
]

export const NFT_ART_MANIFEST: Readonly<Record<string, NftArt>> = Object.fromEntries(MANIFEST_ENTRIES)

/** Arte quadrada usada quando a URL não está no manifest (ex.: imagem futura vinda da API). */
const FALLBACK: NftArt = { width: 1, height: 1 }

/** Dimensões da arte de `imageUrl` (ou 1:1 se desconhecida); só a proporção importa para o layout. */
export function nftArtSize(imageUrl: string): NftArt {
  return NFT_ART_MANIFEST[imageUrl] ?? FALLBACK
}
