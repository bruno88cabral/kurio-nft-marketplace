#!/usr/bin/env node
/**
 * `pnpm lighthouse` (MYK-1116): sobe o `vite preview` sobre o `dist/`, roda o Lighthouse 3 vezes por
 * página × perfil, grava os relatórios HTML/JSON e calcula a mediana de cada categoria e de
 * LCP/CLS/TBT em `lighthouse/reports/summary.{json,md}`. Sai com 0 mesmo abaixo da meta: o
 * relatório é o produto. Configuração em `lighthouse/config.mjs`; a análise do que ficou abaixo da
 * meta fica em `lighthouse/notes.md` e é anexada ao `summary.md`.
 */
import { execSync, spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { join } from 'node:path'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import { categories, chromeFlags, metrics, pages, port, profiles, reportsDir, runs, targets } from './config.mjs'

const origin = `http://localhost:${port}`

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`preview não respondeu em ${url}`)
}

async function measure(url, profile) {
  const chrome = await chromeLauncher.launch({ chromeFlags })
  try {
    const result = await lighthouse(
      url,
      { port: chrome.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: categories },
      profile === 'desktop' ? desktopConfig : undefined,
    )
    if (!result) throw new Error(`sem resultado para ${url}`)
    return result
  } finally {
    chrome.kill()
  }
}

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim()
  } catch {
    return 'desconhecido'
  }
}

const fmtMs = (ms) => `${Math.round(ms)} ms`
const fmtCls = (v) => v.toFixed(3)

async function main() {
  rmSync(reportsDir, { recursive: true, force: true })
  mkdirSync(reportsDir, { recursive: true })

  const preview = spawn('node_modules/.bin/vite', ['preview', '--port', String(port), '--strictPort'], {
    stdio: 'ignore',
  })
  const results = []
  const benchmarks = []
  let tool = { lighthouse: '', chrome: '' }
  try {
    await waitForServer(origin)
    for (const page of pages) {
      for (const profile of profiles) {
        const scores = Object.fromEntries(categories.map((c) => [c, []]))
        const values = Object.fromEntries(Object.keys(metrics).map((m) => [m, []]))
        for (let n = 1; n <= runs; n++) {
          process.stdout.write(`${page.name} ${profile} ${n}/${runs}: `)
          const { lhr, report } = await measure(origin + page.path, profile)
          const base = join(reportsDir, `${page.name}-${profile}-${n}.report`)
          writeFileSync(`${base}.html`, report[0])
          writeFileSync(`${base}.json`, report[1])
          for (const c of categories) scores[c].push(Math.round((lhr.categories[c]?.score ?? 0) * 100))
          for (const [m, id] of Object.entries(metrics)) values[m].push(lhr.audits[id]?.numericValue ?? NaN)
          benchmarks.push(lhr.environment.benchmarkIndex)
          tool = {
            lighthouse: lhr.lighthouseVersion,
            chrome: lhr.environment.hostUserAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? 'desconhecido',
          }
          console.log(categories.map((c) => scores[c].at(-1)).join(' / '))
        }
        results.push({
          page: page.name,
          label: page.label,
          path: page.path,
          profile,
          scores,
          medians: Object.fromEntries(categories.map((c) => [c, median(scores[c])])),
          metrics: values,
          metricMedians: Object.fromEntries(Object.keys(metrics).map((m) => [m, median(values[m])])),
        })
      }
    }
  } finally {
    preview.kill()
  }

  const environment = {
    date: new Date().toISOString(),
    commit: sh('git rev-parse --short HEAD'),
    lighthouse: tool.lighthouse,
    chrome: tool.chrome,
    node: process.version,
    pnpm: sh('pnpm --version'),
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: `${os.cpus()[0]?.model} x ${os.cpus().length}`,
    memory: `${Math.round(os.totalmem() / 2 ** 30)} GiB`,
    benchmarkIndex: median(benchmarks),
    mobile: 'padrão do Lighthouse: Moto G Power emulado, 4G lento (150 ms RTT, 1,6 Mbps), CPU 4x, throttling simulate',
    desktop: 'preset desktop do Lighthouse: 1350x940, 40 ms RTT, 10 Mbps, CPU 1x, throttling simulate',
    build: 'pnpm build + vite preview, VITE_ENABLE_MOCKS=true, cenário default dos mocks',
    runs,
  }
  writeFileSync(join(reportsDir, 'summary.json'), JSON.stringify({ environment, targets, results }, null, 2) + '\n')

  const head = `| Página | Perfil | ${categories.map((c) => `${c} (meta ${targets[c]})`).join(' | ')} | LCP | CLS | TBT |`
  const sep = `|${'---|'.repeat(categories.length + 5)}`
  const rows = results.map((r) => {
    const cells = categories.map((c) => {
      const ok = r.medians[c] >= targets[c] ? 'ok' : 'abaixo'
      return `**${r.medians[c]}** ${ok} (${r.scores[c].join(', ')})`
    })
    const m = r.metricMedians
    return `| ${r.label} | ${r.profile} | ${cells.join(' | ')} | ${fmtMs(m.LCP)} | ${fmtCls(m.CLS)} | ${fmtMs(m.TBT)} |`
  })
  const table = [head, sep, ...rows].join('\n')
  let notes = ''
  try {
    notes = readFileSync('lighthouse/notes.md', 'utf8')
  } catch {
    // sem notas
  }
  const md = `# Lighthouse: medianas (§10)

Gerado por \`pnpm lighthouse\` (\`lighthouse/run.mjs\`, configuração em \`lighthouse/config.mjs\`).
Mediana de **cada categoria** e de cada métrica sobre ${runs} execuções; entre parênteses, as ${runs} notas.
Relatórios por execução: \`<pagina>-<perfil>-<n>.report.{html,json}\` nesta pasta.

${table}

## Ambiente

- Data: ${environment.date}
- Commit medido: ${environment.commit}
- Lighthouse ${environment.lighthouse}, Chrome ${environment.chrome} (do sistema, headless), Node ${environment.node}, pnpm ${environment.pnpm}
- SO: ${environment.os}; CPU: ${environment.cpu}; memória: ${environment.memory}; benchmarkIndex (mediana): ${environment.benchmarkIndex}
- Build: ${environment.build}
- Mobile: ${environment.mobile}
- Desktop: ${environment.desktop}
- Cada execução num Chrome novo, com perfil limpo (primeira visita: o Service Worker do MSW é registrado de novo)
${notes ? `\n${notes}` : ''}`
  writeFileSync(join(reportsDir, 'summary.md'), md)
  console.log(`\n${table}\n\nRelatórios em ${reportsDir}/`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
