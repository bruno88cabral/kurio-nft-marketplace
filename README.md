# Kurio - Marketplace de NFTs

Front-end do marketplace Kurio (desafio Jungle Gaming). Stack: React 19, Vite, TypeScript, TanStack Router/Query, Tailwind v4 + shadcn/ui, Axios, Socket.IO, MSW.

> Estado atual: **M0 (Fundação)**. O app shell, o design system, os contratos tipados e o spike de tempo real existem. As telas e os fluxos de negócio (M1 em diante) ainda **não** existem. Tudo o que depende deles está marcado com `TODO`.

> TODO: a URL pública da Vercel ainda não existe. O deploy está pendente (ação manual, ver [Deploy](#deploy-vercel)) e esta seção deve receber o link depois dele.

## Requisitos

- Node 24.x (desenvolvido com 24.22)
- pnpm 12.x (desenvolvido com 12.8.1)

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

O dev server sobe em `http://localhost:5173` (porta padrão do Vite). Para outra porta: `pnpm dev --port 5201 --strictPort`.

Após o `pnpm dev`, a rota `/` mostra um painel de debug **temporário** (resultado do `GET /api/health` mockado, estado do socket e o último `nft.updated`). Ele existe só para o spike do R1 e será removido na MYK-1049.

### Variáveis de ambiente

Definidas em `.env.example` e tipadas em `src/vite-env.d.ts`.

| Variável | Valor no `.env.example` | Descrição |
| -- | -- | -- |
| `VITE_ENABLE_MOCKS` | `true` | Quando `true`, o app inicia o MSW (REST via Service Worker e Socket.IO mockado) antes de renderizar. Com qualquer outro valor o MSW não é carregado e as chamadas `/api` falham com `ApiError`. |
| `VITE_API_URL` | `/api` | `baseURL` do cliente Axios (`src/api/client.ts`). Se ausente, usa `/api`. |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.mock` | Host do Socket.IO. O mock responde neste host (`ws.link`). |

## Comandos

| Comando | O que faz |
| -- | -- |
| `pnpm dev` | Servidor de desenvolvimento (Vite). |
| `pnpm build` | `tsc -b && vite build`. Saída em `dist/`. |
| `pnpm preview` | Serve o build de produção localmente. |
| `pnpm typecheck` | `tsc -b`. |
| `pnpm lint` | `eslint .`. |
| `pnpm test` | `vitest run` (hoje: `EthAmount`/`big.js` e o interceptor do Axios). |

## Deploy (Vercel)

> TODO: deploy **pendente**. Nenhum deploy foi feito até aqui. O spike do R1 foi validado apenas em `pnpm build && pnpm preview` local (ver `ARCHITECTURE.md`). Passos para o humano:

1. Na Vercel: **Add New -> Project** e importar o repositório do GitHub.
2. Framework preset **Vite**, build command `pnpm build`, output directory `dist`. O `vercel.json` já tem o rewrite de SPA e o `pnpm-workspace.yaml` evita o erro de postinstall do `msw` no install.
3. Em Settings -> Environment Variables (Production e Preview): `VITE_ENABLE_MOCKS=true`, `VITE_API_URL=/api`, `VITE_SOCKET_URL=wss://realtime.kurio.mock`.
4. Fazer o deploy e conferir em aba anônima: painel da rota `/` com o `health` mockado, `socket: connected` e o contador de `nft.updated` subindo a cada 5s; refresh direto em `/nfts/abc` e `/cart` carregando a SPA; `/mockServiceWorker.js` respondendo JavaScript.

## Documentação

- [`ARCHITECTURE.md`](./ARCHITECTURE.md): estrutura, decisões do M0 e esqueleto das seções que serão preenchidas.

## Credenciais fictícias

> TODO (M1/M6): usuários de teste. Ainda não há login funcional nem mock de sessão.

## Cenários de mock e reset

> TODO (M1/M6): seleção de cenário (latência, timeout, falhas) e reset do estado do mock. Ainda não implementado.

## Reprodução de falhas

> TODO (M1/M6): como reproduzir cada falha (erro de rede, 409, evento duplicado, etc.).

## Testes E2E (Playwright)

> TODO (M5/M6): ainda não há Playwright configurado.

## Lighthouse

> TODO (M5/M6): ainda não foi medido.
