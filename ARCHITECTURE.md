# Arquitetura

Documento vivo. Hoje cobre o **M0 (Fundação)**: as decisões já tomadas e implementadas estão preenchidas; o que depende de M1 em diante está como `TODO` e **não** deve ser lido como funcionando.

## Estrutura de pastas

```
src/
  api/          cliente HTTP (Axios) e normalização de erros em ApiError
  app/          bootstrap (start.tsx), router e QueryClient
  components/ui componentes shadcn/ui (estilo radix-vega)
  contracts/    contratos tipados de REST e eventos (fonte única)
  lib/          utilitários puros (cn, eth, redirectSearch)
  mocks/        MSW: browser.ts, runtime.ts (store + cenário via ?scenario=), handlers REST (handlers/, todos via withScenario) e socket.ts
  realtime/     instância do socket.io-client
  routes/       rotas do TanStack Router (file-based; routeTree.gen.ts é gerado)
public/
  fonts/        Roboto Mono self-hosted (.woff2 de 400/500/700)
  mockServiceWorker.js
```

**Regra: os tipos em `src/contracts` são a fonte única** de formato de dados. O cliente, os mocks (handlers REST e emissão de eventos) e, no futuro, os testes importam dos mesmos tipos. Nenhum tipo de payload é redeclarado fora dali.

Alias `@/` aponta para `src/` (via `paths`, sem `baseUrl`, que é obsoleto no TypeScript 6).

## Valores em ETH

- `EthAmount` (`src/contracts/money.ts`) é uma string decimal com brand (`string & { [brand]: true }`), por exemplo `"0.125"`. Nunca `number`.
- `src/lib/eth.ts` usa `big.js`: `parseEth` (valida e cria o brand), `formatEth`, `addEth`, `mulEth`. Testes em `src/lib/eth.test.ts`.
- Decisão: **o cálculo (subtotal, desconto, taxa) é responsabilidade do mock**, que é a fonte da verdade da cotação; o cliente só formata para exibição.
- TODO (M1/M4): os handlers que calculam cotação e o consumo de `formatEth` nas telas ainda não existem. Hoje só há contrato e helpers testados.

## Transporte de tempo real

Decisão: `@mswjs/socket.io-binding` sobre `ws.link` do MSW, com `socket.io-client` configurado com `transports: ['websocket']` e `autoConnect: false` (`src/realtime/socket.ts`). O socket é tipado com `Socket<ServerToClientEvents, ClientToServerEvents>`; `ClientToServerEvents` é `Record<string, never>` (o cliente não emite nada) e foi confirmado que compila com o `socket.io-client`.

O mock (`src/mocks/socket.ts`) assina o bus do estado e entrega `nft.updated` a todas as conexões e `order.updated` só ao dono do pedido (token em `?token=` da URL do socket). O emissor periódico do spike saiu; `window.__kurioMock` dispara eventos pelo estado. Doc completa na MYK-1068.

### Resultado do spike R1 (MYK-1057)

- **Validado em `pnpm build && pnpm preview` local** (Chrome headless via CDP): `GET /api/health` mockado, `socket: connected`, `nft.updated` a cada 5s, uma única conexão estável por 62s (12 eventos, sem reconexão).
- **Vercel: PENDENTE.** Não houve deploy. Por isso o R1 está **parcialmente mitigado**, não mitigado. Os passos do deploy estão no `README.md`.

### Correções necessárias no spike

1. **`ws.link` na raiz do host.** O link é `ws.link('<VITE_SOCKET_URL>/*')` (padrão `wss://realtime.kurio.mock`, definido uma vez em `src/app/env.ts` e usado também pelo cliente em `src/realtime/socket.ts`; o mesmo vale para `API_URL` no Axios e no handler de `health`). Com `'/socket.io/*'` nada casa, porque o MSW remove o prefixo `/socket.io/` da URL do cliente antes de comparar (`msw/src/core/handlers/WebSocketHandler.ts:79`). Sem match, o MSW deixa passar e o navegador abre um WebSocket real.
2. **O `main.tsx` só importa o app depois do `worker.start`.** O `engine.io-client` guarda `globalThis.WebSocket` quando o módulo é avaliado; se o `socket.io-client` entrar no grafo estático do `main.tsx`, ele captura o WebSocket original antes do patch do MSW. Chamar `socket.connect()` depois do `enableMocks()` não basta. Por isso `src/main.tsx` faz `await enableMocks()` e só então `import('./app/start')`; se o mock falhar, o erro vai para `console.error('[mocks]', e)` e o app sobe mesmo assim. **Regra para M1+: nada em `main.tsx` pode importar `socket.io-client`, direta ou indiretamente.**
3. **Heartbeat no mock.** O handshake falso do binding anuncia `pingInterval` de 25s, mas o binding nunca envia ping, e o cliente derrubava a conexão em cerca de 30s. O mock envia o ping do Engine.IO (`'2'`) a cada 25s.

### Limitações observadas

- A aba **WS do DevTools não mostra** a conexão: o WebSocket é falso (patch em memória do MSW) e não chega à rede. A evidência está no console do MSW (`▶`, `⬇`, `⬆`).
- Sem **rooms, namespaces ou broadcast** (limitação do binding).
- Sem **long-polling**: o binding intercepta o `WebSocket`, não HTTP. Por isso `transports: ['websocket']` é obrigatório.
- O evento imediato pós-handshake pode chegar antes de a rota registrar o `socket.on` (a rota é carregada sob demanda) e se perde. É semântica normal de tempo real e fica para a reconciliação (ver seção própria).
- O painel de debug em `src/routes/index.tsx` é temporário (removido na MYK-1049).

## Versões fixadas e por quê

- `msw@^2.15` (2.x): é o peer do `@mswjs/socket.io-binding` (0.2.0). O `msw init` deve ser feito com a versão local (`pnpm exec msw init public --save`), não com `pnpm dlx`, que baixaria o msw 3.x e geraria um worker incompatível.
- `typescript@~6.0.3`: limite de suporte do `typescript-eslint`. O template atual do Vite vinha com oxlint/TS 7; foram trocados por ESLint + TS 6.
- `pnpm` 12.x e Node 24.x (12.x é a versão usada no desenvolvimento).
- `pnpm-workspace.yaml` com `allowBuilds: { msw: false }`: o pnpm 12 falha o install com `ERR_PNPM_IGNORED_BUILDS` por causa do postinstall do msw. O worker já está commitado em `public/mockServiceWorker.js`, então o postinstall não faz falta.

## Política inicial do QueryClient

`src/app/queryClient.ts`: `staleTime: 30_000` e `retry: 1` para queries. A intenção é evitar refetch a cada navegação e deixar o tempo real atualizar preço e estoque. São valores iniciais do M0.

TODO (M4): política por recurso, mutações, e a ligação dos eventos do socket ao cache. Hoje nenhum evento atualiza o cache. `withCredentials` no Axios entra com a sessão no M3.

## Tema

**Dark-only**, conforme o Figma. `@custom-variant dark (&:is(*))` mantém a variante `dark` sempre ativa e `color-scheme: dark` está no `src/index.css`. Tokens `--kurio-*` e variáveis do shadcn estão no mesmo arquivo; fonte Roboto Mono self-hosted com `preload` do peso 400 no `index.html`. A rota `/dev/tokens` existe só em DEV.

## Erros de API

`src/api/client.ts` exporta `apiClient`. O interceptor sempre lança `ApiError` (`src/contracts/errors.ts`). Sem resposta, timeout, 5xx, 408 e 429 viram `code: 'transient'`. Resposta 2xx com `text/html` (fallback da SPA respondendo `/api` sem API atrás) também vira `ApiError` `transient`. Sem fallback de dados.

## Desempenho (base do R2)

Base aplicada: fonte self-hosted com preload, code splitting por rota (`autoCodeSplitting` do TanStack Router) e MSW fora do chunk de entrada (import dinâmico; o chunk `browser-*` só existe com `VITE_ENABLE_MOCKS=true`). TODO (M5): imagens, LCP/CLS/TBT e medição com Lighthouse. Ainda não foi medido. Scripts `test:e2e` e `lighthouse` entram no M5.

## Seções do enunciado (§12) a preencher

> Os títulos abaixo seguem o que o enunciado exige no ARCHITECTURE.md. Nenhum deles está implementado no M0.

### Contratos

Parcial: os tipos existem em `src/contracts` (`nft`, `quote`, `order`, `session`, `cart`, `favorite`, `profile`, `wallet`, `errors`, `events`, `health`, `common`, `money`). TODO (M1/M6): documentar cada endpoint, códigos de erro, `Idempotency-Key` e o formato dos eventos com `eventId` e `version`.

### Sessão

> TODO (M1/M4): como a sessão é criada, persistida e invalidada. Ainda não implementado (as rotas `_authenticated` são vazias).

### Carrinho

> TODO (M1/M4): origem da verdade, cotação e limites. Ainda não implementado.

### Cache

> TODO (M4): política por recurso e invalidação. Só vale o padrão inicial descrito acima.

### Reconciliação

> TODO (M4): descarte por `version`, dedupe por `eventId` e `invalidateQueries` na reconexão. Ainda não implementado.

### Limitações conhecidas

> TODO (M6): consolidar. Por enquanto valem as limitações do transporte de tempo real acima e o deploy na Vercel pendente.

### Desvios do Figma

> TODO (M2/M6): registrar divergências entre as telas implementadas e o Figma. Nenhuma tela foi implementada ainda.

### Decisões de UX

> TODO (M2/M6): consolidar as decisões de UX tomadas durante a implementação das telas. Nenhuma tela implementada ainda (só placeholders). Decisões já definidas no planejamento (não implementadas):
>
> - Ações fora do escopo do desafio ficam **desabilitadas com tooltip "Em breve"** (planejado; ainda a confirmar na MYK-1059).
> - O app é **dark-only**, conforme o Figma. Esta decisão já está aplicada no tema (ver "Tema").

### Substituição de assets

> TODO (M2/M6): registrar assets do Figma que foram substituídos (imagens, ícones, fontes) e o motivo. Até o M0 só a fonte Roboto Mono foi adicionada, self-hosted. Os `.woff2` de `public/fonts/` foram copiados do pacote `@fontsource/roboto-mono` 5.3.0 (licença OFL-1.1); a devDependency fica como origem dos arquivos. TODO: `public/favicon.svg` ainda é o do template do Vite; trocar pela marca do Kurio.

### Ajustes de acessibilidade

> TODO (M2/M5/M6): registrar ajustes de acessibilidade feitos em relação ao Figma (contraste, foco, rótulos). Ainda não auditado.
