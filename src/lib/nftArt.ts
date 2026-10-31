/**
 * Manifest das artes de `public/nfts/`: caminho público → dimensões intrínsecas.
 * Componentes passam `width`/`height` para o `<img>` reservar o espaço (CLS, risco R2).
 *
 * Hoje são as SVGs placeholder geradas no M1 (`viewBox="0 0 120 120"`), porque a exportação do
 * Figma não foi possível (cota do MCP; ver ARCHITECTURE.md, "Substituição de assets").
 * `nftArt.test.ts` confere este manifest contra os arquivos do disco e as fixtures do mock.
 */
export interface NftArt {
  width: number
  height: number
}

const SVG_120: NftArt = { width: 120, height: 120 }

export const NFT_ART_MANIFEST: Readonly<Record<string, NftArt>> = {
  '/nfts/anemone-8-bit.svg': SVG_120,
  '/nfts/atlas-zero.svg': SVG_120,
  '/nfts/aurora-prime.svg': SVG_120,
  '/nfts/basalt-bloom.svg': SVG_120,
  '/nfts/coal-petal.svg': SVG_120,
  '/nfts/cold-ember.svg': SVG_120,
  '/nfts/comet-mailer.svg': SVG_120,
  '/nfts/coral-byte.svg': SVG_120,
  '/nfts/crease-nova.svg': SVG_120,
  '/nfts/dawn-ribbon.svg': SVG_120,
  '/nfts/deep-dither.svg': SVG_120,
  '/nfts/folded-tail.svg': SVG_120,
  '/nfts/glacial-pulse.svg': SVG_120,
  '/nfts/grid-lantern.svg': SVG_120,
  '/nfts/jet-orchid.svg': SVG_120,
  '/nfts/kelp-sprite.svg': SVG_120,
  '/nfts/meridian-glow.svg': SVG_120,
  '/nfts/newsprint-halo.svg': SVG_120,
  '/nfts/night-compass.svg': SVG_120,
  '/nfts/onyx-fern.svg': SVG_120,
  '/nfts/origami-orbit.svg': SVG_120,
  '/nfts/polar-hum.svg': SVG_120,
  '/nfts/reef-pulse.svg': SVG_120,
  '/nfts/shadow-moss.svg': SVG_120,
  '/nfts/signal-bloom.svg': SVG_120,
  '/nfts/slate-vine.svg': SVG_120,
  '/nfts/solar-veil.svg': SVG_120,
  '/nfts/tide-glitch.svg': SVG_120,
  '/nfts/tokyo-drift-map.svg': SVG_120,
  '/nfts/vellum-streak.svg': SVG_120,
}

/** Arte quadrada usada quando a URL não está no manifest (ex.: imagem futura vinda da API). */
const FALLBACK: NftArt = { width: 1, height: 1 }

/** Dimensões da arte de `imageUrl` (ou 1:1 se desconhecida); só a proporção importa para o layout. */
export function nftArtSize(imageUrl: string): NftArt {
  return NFT_ART_MANIFEST[imageUrl] ?? FALLBACK
}
