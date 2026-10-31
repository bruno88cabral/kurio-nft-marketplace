import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { NFTS } from '@/mocks/fixtures/nfts'
import { NFT_ART_MANIFEST, nftArtSize } from './nftArt'

const NFTS_DIR = fileURLToPath(new URL('../../public/nfts/', import.meta.url))

describe('manifest das artes', () => {
  const files = readdirSync(NFTS_DIR).filter((f) => /\.(svg|webp|avif)$/.test(f))

  it('lista exatamente os arquivos de public/nfts', () => {
    expect(Object.keys(NFT_ART_MANIFEST).sort()).toEqual(files.map((f) => `/nfts/${f}`).sort())
  })

  it('tem as dimensões reais (viewBox) de cada SVG', () => {
    for (const file of files.filter((f) => f.endsWith('.svg'))) {
      const svg = readFileSync(`${NFTS_DIR}${file}`, 'utf8')
      const match = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg)
      expect(match, file).not.toBeNull()
      expect(NFT_ART_MANIFEST[`/nfts/${file}`]).toEqual({
        width: Number(match?.[1]),
        height: Number(match?.[2]),
      })
    }
  })

  it('cobre toda imageUrl das fixtures', () => {
    for (const nft of NFTS) expect(NFT_ART_MANIFEST[nft.imageUrl], nft.imageUrl).toBeDefined()
  })

  it('usa 1:1 para arte desconhecida', () => {
    expect(nftArtSize('/nfts/nao-existe.webp')).toEqual({ width: 1, height: 1 })
  })
})
