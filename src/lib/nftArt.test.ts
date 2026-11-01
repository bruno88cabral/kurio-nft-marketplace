import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { NFTS } from '@/mocks/fixtures/nfts'
import { NFT_ART_MANIFEST, NFT_ART_WIDTHS, NFT_ARTS, nftArtSize, type NftArt, type NftArtWidth } from './nftArt'

const NFTS_DIR = fileURLToPath(new URL('../../public/nfts/', import.meta.url))

/** Metas de peso por largura (MYK-1079), em bytes. */
const BUDGET: Record<NftArtWidth, number> = { 320: 25_000, 960: 100_000 }

/** Dimensões do cabeçalho: `VP8X` (WebP estendido, com alpha), `ispe` (AVIF) ou `viewBox` (SVG). */
function intrinsicSize(file: string): NftArt | null {
  const buf = readFileSync(`${NFTS_DIR}${file}`)
  if (file.endsWith('.webp')) {
    if (buf.toString('ascii', 12, 16) !== 'VP8X') return null
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 }
  }
  if (file.endsWith('.avif')) {
    const at = buf.indexOf('ispe')
    if (at < 0) return null
    return { width: buf.readUInt32BE(at + 8), height: buf.readUInt32BE(at + 12) }
  }
  const match = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(buf.toString('utf8'))
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null
}

describe('manifest das artes', () => {
  const files = readdirSync(NFTS_DIR).filter((f) => /\.(svg|webp|avif)$/.test(f))

  it('lista exatamente os arquivos de public/nfts', () => {
    expect(Object.keys(NFT_ART_MANIFEST).sort()).toEqual(files.map((f) => `/nfts/${f}`).sort())
  })

  it('tem as dimensões reais de cada arquivo', () => {
    for (const file of files) expect(NFT_ART_MANIFEST[`/nfts/${file}`], file).toEqual(intrinsicSize(file))
  })

  it('registra AVIF e WebP em 320 e 960 para cada arte, dentro da meta de peso', () => {
    for (const art of NFT_ARTS) {
      expect(art.src).toBe(art.variants[960].webp)
      for (const width of NFT_ART_WIDTHS) {
        for (const path of Object.values(art.variants[width])) {
          expect(NFT_ART_MANIFEST[path], path).toEqual({ width, height: width })
          expect(readFileSync(`${NFTS_DIR}${path.slice('/nfts/'.length)}`).length, path).toBeLessThan(BUDGET[width])
        }
      }
    }
  })

  it('cobre toda imageUrl e toda imagem de galeria das fixtures com o WebP de 960', () => {
    const covers = new Set(NFT_ARTS.map((a) => a.src))
    for (const nft of NFTS) {
      expect(covers.has(nft.imageUrl), nft.imageUrl).toBe(true)
      expect(nft.images[0]).toBe(nft.imageUrl)
      expect(nft.images.length).toBeGreaterThanOrEqual(2)
      expect(nft.images.length).toBeLessThanOrEqual(4)
      expect(new Set(nft.images).size).toBe(nft.images.length)
      for (const src of nft.images) expect(covers.has(src), src).toBe(true)
    }
  })

  it('usa as 4 artes no seed', () => {
    expect(new Set(NFTS.map((n) => n.imageUrl)).size).toBe(NFT_ARTS.length)
  })

  it('usa 1:1 para arte desconhecida', () => {
    expect(nftArtSize('/nfts/nao-existe.webp')).toEqual({ width: 1, height: 1 })
  })
})
