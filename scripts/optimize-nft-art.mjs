#!/usr/bin/env node
/**
 * Converte as artes exportadas do Figma (PNG) para `public/nfts/<slug>-<largura>.<avif|webp>` (MYK-1079).
 *
 * Não entra no bundle nem nas dependências do app: o `sharp` é carregado de fora do repo.
 *
 *   npm i --prefix /tmp/sharp sharp@0.34.5
 *   SHARP_DIR=/tmp/sharp node scripts/optimize-nft-art.mjs "<pasta dos PNGs>"
 *
 * Para cada arte: recorte 1:1 centralizado, larguras 320 e 960 (sem upscale), AVIF (quality 50,
 * effort 6) e WebP (quality 75, effort 6), sem metadados (o sharp não copia EXIF/ICC por padrão).
 * Se um arquivo passar da meta de peso, a quality desce em passos de 5 até caber.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const SOURCES = [
  ['NFT Artwork 03.png', 'macaco-oculos'],
  ['NFT Artwork 04.png', 'macaco-chapeu'],
  ['NFT Artwork 05.png', 'macaco-gola-alta'],
  ['NFT Artwork 09.png', 'macaco-fones'],
]
const WIDTHS = [320, 960]
/** Meta de peso por largura, em bytes (KB = 1000 bytes, o lado mais estrito). */
const BUDGET = { 320: 25_000, 960: 100_000 }
const FORMATS = {
  avif: { quality: 50, effort: 6 },
  webp: { quality: 75, effort: 6 },
}
const MIN_QUALITY = 20

const sourceDir = process.argv[2]
if (!sourceDir) {
  console.error('uso: SHARP_DIR=<dir com node_modules/sharp> node scripts/optimize-nft-art.mjs <pasta dos PNGs>')
  process.exit(1)
}
const require = createRequire(join(process.env.SHARP_DIR ?? process.cwd(), 'noop.js'))
const sharp = require('sharp')

const outDir = new URL('../public/nfts/', import.meta.url).pathname
mkdirSync(outDir, { recursive: true })

const report = []
for (const [file, slug] of SOURCES) {
  const input = join(sourceDir, file)
  const meta = await sharp(input).metadata()
  const side = Math.min(meta.width, meta.height)
  for (const width of WIDTHS) {
    const size = Math.min(width, side)
    for (const [format, options] of Object.entries(FORMATS)) {
      let quality = options.quality
      let buffer
      for (;;) {
        buffer = await sharp(input)
          .resize(size, size, { fit: 'cover', position: 'centre', withoutEnlargement: true })
          [format]({ quality, effort: options.effort })
          .toBuffer()
        if (buffer.length < BUDGET[width] || quality <= MIN_QUALITY) break
        quality -= 5
      }
      const name = `${slug}-${width}.${format}`
      writeFileSync(join(outDir, name), buffer)
      report.push({ name, width: size, height: size, bytes: buffer.length, quality })
    }
  }
}
console.table(report)
