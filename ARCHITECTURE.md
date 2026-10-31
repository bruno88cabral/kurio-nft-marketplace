# Arquitetura

Documento vivo. Hoje cobre o **M0 (Fundação)**, a **camada de mocks do M1** (estado, handlers REST, socket e cenários) e o **M2 (Início, Detalhe do NFT, favoritos, layout e a base da sessão no cliente)**: as decisões já tomadas e implementadas estão preenchidas; o que depende de login, perfil, carteiras, carrinho, checkout e tempo real no cache (M3 em diante) está como `TODO` e **não** deve ser lido como funcionando. As telas do M2 **não foram conferidas contra o Figma** (o MCP estava sem cota): ver "Desvios do Figma".

## Estrutura de pastas

```
src/
  api/          cliente HTTP (Axios), normalização de erros em ApiError e fábricas de query (nfts, favorites)
  app/          bootstrap (start.tsx), router e QueryClient
  auth/         sessão no cliente: sessionStorage.ts (chave kurio:session) e useSession.ts
  components/ui componentes shadcn/ui (estilo radix-vega)
  components/kurio kit de componentes de produto (MYK-1059), só props; conferência em /dev/kit (só DEV)
  components/layout moldura do app: SkipLink, SiteHeader (+ HeaderSearch), SiteFooter, MobileTabBar, SessionLink, BrandLogo
  contracts/    contratos tipados de REST e eventos (fonte única)
  features/     telas do M2, por assunto:
    catalog/      Início: hero, catálogo (filtros, toolbar, grid, paginação), promos, Diário da Cunhagem
    nft-detail/   Detalhe: galeria, info, painel de compra (edição e quantidade), "Mais desta coleção", chrome mobile
    favorites/    favoritos otimistas: favoriteCache, useToggleFavorite, FavoriteButton
  lib/          utilitários puros (cn, eth, catalogSearch, priceRange, redirectSearch, editions, quantity, nftArt)
  mocks/        MSW (ver "Mock"):
    browser.ts    setupWorker, startMocks() e instalação do window.__kurioMock
    runtime.ts    instância única de store + cenário (escolhido na carga via ?scenario=)
    db/           MockDb: schema, seed, store (mutate/persistência), bus, regras puras de carrinho/cotação/pedido
    fixtures/     catálogo (30 NFTs), usuários e cupons
    handlers/     rotas REST, todas envoltas em withScenario
    scenarios/    catálogo de cenários, engine (latência/falha) e PRNG mulberry32
    lifecycle.ts  timers do pedido pending -> confirmed/declined
    socket.ts     ws.link do Socket.IO assinando o bus
    devtools.ts   window.__kurioMock
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
- A cotação (`POST /quotes`, `src/mocks/db/quote.ts`) é calculada no mock só com os helpers de `src/lib/eth.ts` (`addEth`, `subEth`, `mulEth`, `percentEth`): `subtotal = Σ unitPrice × quantity`, `desconto = subtotal × percentOff`, `total = subtotal − desconto + networkFee` (taxa fixa de `0.002`). Os preços unitários ficam congelados no snapshot da cotação. Filtros de preço do catálogo usam `Big` (nunca `Number`).
- No M2 as telas já exibem preços (`PriceTag`, `PriceSummary`, faixa de preço dos filtros) sem aritmética de ponto flutuante. TODO (M4): o consumo nos totais do carrinho e do checkout.

## Transporte de tempo real

Decisão: `@mswjs/socket.io-binding` sobre `ws.link` do MSW, com `socket.io-client` configurado com `transports: ['websocket']` e `autoConnect: false` (`src/realtime/socket.ts`). O socket é tipado com `Socket<ServerToClientEvents, ClientToServerEvents>`; `ClientToServerEvents` é `Record<string, never>` (o cliente não emite nada) e foi confirmado que compila com o `socket.io-client`.

O mock (`src/mocks/socket.ts`) assina o bus do estado (ver "Mock") e entrega `nft.updated` a todas as conexões e `order.updated` só ao dono do pedido. O emissor periódico do spike saiu; `window.__kurioMock` dispara eventos pelo estado.

- **Token da conexão: pela `query`.** O cliente deve abrir com `io(SOCKET_URL, { transports: ['websocket'], query: { token } })`; o token chega em `connection.client.url` (`...?token=<t>&EIO=4&transport=websocket`), validado no browser. O `auth` do Socket.IO só chega no pacote CONNECT (`40{"token":...}`), depois do handshake, e **não** é lido pelo mock. Sem token, ou com token inválido/expirado, a conexão é **anônima** e recebe só `nft.updated`.
- **A conta é resolvida uma vez, no connect.** Uma sessão que expira depois continua recebendo `order.updated`; quem faz login depois de conectar precisa reconectar o socket (nota para o M3/M4: reconectar no login e no logout).
- **Filtro por conta.** O evento do bus não carrega `accountId`; `shouldDeliver` (`src/mocks/db/delivery.ts`) consulta o dono em `db.orders[id].accountId`. O evento `reset` do bus não sai pelo socket.
- **Formato do evento** (`src/contracts/events.ts`): `{ eventId, resource: { type, id }, version, occurredAt, payload }`. `eventId` é UUID; `version` vem de `db.versions['<tipo>:<id>']`, é monotônica por recurso e persiste junto com o db; `reset()` zera as versões (por isso o hook recarrega a página). Payloads: `nft.updated` `{ id, price, editions }`, `order.updated` `{ id, status }`.
- Ao fechar a conexão o mock cancela a assinatura do bus e o heartbeat de 25s.

### Resultado do spike R1 (MYK-1057)

- **Validado em `pnpm build && pnpm preview` local** (Chrome headless via CDP): `GET /api/health` mockado, `socket: connected`, `nft.updated` a cada 5s (emissor removido no M1), uma única conexão estável por 62s (12 eventos, sem reconexão).
- **Vercel: PENDENTE.** Não houve deploy. Por isso o R1 está **parcialmente mitigado**, não mitigado. Os passos do deploy estão no `README.md`.

### Correções necessárias no spike

1. **`ws.link` na raiz do host.** O link é `ws.link('<VITE_SOCKET_URL>/*')` (padrão `wss://realtime.kurio.mock`, definido uma vez em `src/app/env.ts` e usado também pelo cliente em `src/realtime/socket.ts`; o mesmo vale para `API_URL` no Axios e no handler de `health`). Com `'/socket.io/*'` nada casa, porque o MSW remove o prefixo `/socket.io/` da URL do cliente antes de comparar (`msw/src/core/handlers/WebSocketHandler.ts:79`). Sem match, o MSW deixa passar e o navegador abre um WebSocket real.
2. **O `main.tsx` só importa o app depois do `worker.start`.** O `engine.io-client` guarda `globalThis.WebSocket` quando o módulo é avaliado; se o `socket.io-client` entrar no grafo estático do `main.tsx`, ele captura o WebSocket original antes do patch do MSW. Chamar `socket.connect()` depois do `enableMocks()` não basta. Por isso `src/main.tsx` faz `await enableMocks()` e só então `import('./app/start')`; se o mock falhar, o erro vai para `console.error('[mocks]', e)` e o app sobe mesmo assim. **Regra para M1+: nada em `main.tsx` pode importar `socket.io-client`, direta ou indiretamente.**
3. **Heartbeat no mock.** O handshake falso do binding anuncia `pingInterval` de 25s, mas o binding nunca envia ping, e o cliente derrubava a conexão em cerca de 30s. O mock envia o ping do Engine.IO (`'2'`) a cada 25s.

### Limitações observadas

- A aba **WS do DevTools não mostra** a conexão: o WebSocket é falso (patch em memória do MSW) e não chega à rede. A evidência está no console do MSW (`▶`, `⬇`, `⬆`).
- Sem **rooms, namespaces ou broadcast** (limitação do binding). O mock contorna: cada conexão assina o bus e filtra por conta (`nft.updated` para todas; `order.updated` só para o dono do pedido, identificado pelo token da `query`).
- Sem **long-polling**: o binding intercepta o `WebSocket`, não HTTP. Por isso `transports: ['websocket']` é obrigatório.
- Um evento publicado logo após o handshake pode chegar antes de a rota registrar o `socket.on` (a rota é carregada sob demanda) e se perde. É semântica normal de tempo real e fica para a reconciliação (ver seção própria).
- O painel de debug do spike saiu de `src/routes/index.tsx` na MYK-1075. Hoje nenhuma tela escuta o socket: `src/app/start.tsx` só chama `socket.connect()` (mantido) e nenhum evento atualiza o cache (M4). Por isso a checagem do R1 no deploy não tem mais o painel como evidência (ver `README.md`).

## Mock (camada do M1)

O mock é a "API" do app: tudo passa pelos handlers do MSW, nada é respondido no cliente. Fica em `src/mocks/` e só carrega com `VITE_ENABLE_MOCKS=true` (import dinâmico em `main.tsx`, que chama `startMocks()`).

- **Estado único (`MockDb`, `src/mocks/db/schema.ts`).** Usuários, sessões, NFTs, favoritos, carrinhos, cotações, pedidos, idempotência, carteiras, perfis e `versions`. O REST e o socket leem o mesmo objeto, então um evento nunca contradiz o que o REST devolve.
- **Mutação.** `store.mutate((db, touch) => ...)` é síncrono e roda numa cópia; `touch(tipo, id)` declara o que mudou e incrementa `db.versions['<tipo>:<id>']`. Lançar dentro do `mutate` desfaz tudo (rollback). Nada altera `store.getDb()` fora do `mutate`. As regras de negócio são funções puras em `db/` (`cart.ts`, `quote.ts`, `orders.ts`, `orderLifecycle.ts`) que lançam `DomainError`; `handlers/domain.ts` (`domainGuard`) traduz para `ApiErrorBody`.
- **Bus.** Só `touch('nft', id)` e `touch('order', id)` publicam (`nft.updated`, `order.updated`), depois de persistir. `reset()` publica um evento interno `reset`, que não sai pelo socket. `bus.publish` isola cada listener em try/catch; `bus.last()` guarda o último evento (usado por `duplicateLast`).
- **Persistência.** Chave `kurio:mock-db:v1` no `localStorage`, no formato `{ schema: 1, catalog: 'full' | 'empty', db }`. Um schema ou catálogo diferente (cenário `empty` x demais) refaz o seed sozinho. Sem `localStorage` o mock usa memória. O cenário ativo fica em `kurio:mock-scenario`.
- **Cenários.** `?scenario=<nome>` vence o cenário persistido, que vence `default` (`resolveScenarioName`). Trocar de cenário reinicia o db a partir do seed. Cada cenário é um dado de `src/mocks/scenarios/catalog.ts` (latência, falhas por método/rota, latência por rota e regras); a lista e a reprodução estão no `README.md`. Latência base de 150ms; o `apiClient` tem timeout de 10s (`slow` e `jitter` ficam abaixo, `order-timeout` passa).
- **`withScenario(método, rota, resolver)`.** Todo handler (inclusive `GET /health`) é envolto nele: espera a latência do cenário, aplica a falha casada (`offline` vira erro de rede; o resto responde JSON `ApiErrorBody`) e só então chama o resolver. Erros de handler são `raise(apiError(...))`, nunca `throw` (lint `only-throw-error`). Só `POST /orders` usa `slowRouteLatencyWhen`: a latência longa vale apenas para a resposta que **criou** o pedido (201), então o retry com a mesma chave (200) volta rápido.
- **Ciclo do pedido (`src/mocks/lifecycle.ts`).** `POST /orders` cria o pedido `pending` e arma um timer por pedido (`orderSettleMs`, 2,5s por padrão). Ao vencer, o pedido vira `confirmed` (gera `txHash`/`explorerUrl`, baixa o estoque, tira do carrinho só o que foi comprado, publica `nft.updated` por NFT e `order.updated`) ou `declined` (cenário `payment-declined`, ou estoque que já não cobre o pedido; só `order.updated`). Estados finais não regridem. Os timers são **re-armados no start** (`resumePendingOrders`, usando o tempo restante), então um refresh não deixa pedido parado em `pending`.
- **`window.__kurioMock`** (`src/mocks/devtools.ts`, instalado em `startMocks` só com `VITE_ENABLE_MOCKS === 'true'`). Funções que falham lançam `Error`.

  | Membro | O que faz |
  | -- | -- |
  | `scenario` | Nome do cenário ativo nesta página. |
  | `setScenario(nome)` | Valida, persiste o cenário e recarrega, já sem `?scenario=` na URL (senão a query venceria o cenário novo). O db recomeça do seed quando o cenário muda. |
  | `reset(nome?)` | Valida o nome, `store.reset()` (volta ao seed e zera `versions`), persiste o cenário se vier um e recarrega sem `?scenario=` na URL. |
  | `emit.nftUpdated(nftId, { price?, editions? })` | Altera o NFT via `mutate` (o `price` é validado com `parseEth`); o bus publica `nft.updated` com `version` maior. |
  | `emit.orderUpdated(orderId)` | Re-publica o status atual do pedido com `version` + 1. |
  | `duplicateLast()` | Re-publica o último evento com o **mesmo** `eventId` e `version` (entrega duplicada). |

  O recarregamento evita que o cliente fique com `version` velha depois de zerar as versões; `store.reset()` fora do hook não avisa os clientes.
- **Determinismo.** Seed fixo (sem `Date.now()`/`randomUUID()` no seed), IDs previsíveis (`user-ana`, `user-bruno`, `nft-001`…`nft-030`, `wallet-ana-1`, `wallet-bruno-1`, `wallet-bruno-2`) e PRNG `mulberry32` com seed no `jitter`. O PRNG do `jitter` e os contadores `afterRequests` vivem por carga de página. Tokens, cotações e pedidos usam `crypto.randomUUID()`.

## Versões fixadas e por quê

- `msw@^2.15` (2.x): é o peer do `@mswjs/socket.io-binding` (0.2.0). O `msw init` deve ser feito com a versão local (`pnpm exec msw init public --save`), não com `pnpm dlx`, que baixaria o msw 3.x e geraria um worker incompatível.
- `typescript@~6.0.3`: limite de suporte do `typescript-eslint`. O template atual do Vite vinha com oxlint/TS 7; foram trocados por ESLint + TS 6.
- `pnpm` 12.x e Node 24.x (12.x é a versão usada no desenvolvimento).
- `pnpm-workspace.yaml` com `allowBuilds: { msw: false }`: o pnpm 12 falha o install com `ERR_PNPM_IGNORED_BUILDS` por causa do postinstall do msw. O worker já está commitado em `public/mockServiceWorker.js`, então o postinstall não faz falta.

## Política inicial do QueryClient

`src/app/queryClient.ts`: `staleTime: 30_000` e `retry: 1` para queries. A intenção é evitar refetch a cada navegação e deixar o tempo real atualizar preço e estoque. São os valores padrão; o M2 acrescentou as exceções por recurso descritas em "Cache" (chaves, `keepPreviousData`, sem retry no 404, favoritos otimistas). O router usa `defaultPreload: 'intent'` (`src/app/router.tsx`).

TODO (M4): a ligação dos eventos do socket ao cache. Hoje nenhum evento atualiza o cache. `withCredentials` no Axios entra com a sessão no M3.

## Tema

**Dark-only**, conforme o Figma. `@custom-variant dark (&:is(*))` mantém a variante `dark` sempre ativa e `color-scheme: dark` está no `src/index.css`. Tokens `--kurio-*` e variáveis do shadcn estão no mesmo arquivo; fonte Roboto Mono self-hosted com `preload` do peso 400 no `index.html`. A rota `/dev/tokens` existe só em DEV.

## Erros de API

`src/api/client.ts` exporta `apiClient`. O interceptor sempre lança `ApiError` (`src/contracts/errors.ts`). Sem resposta, timeout, 5xx, 408 e 429 viram `code: 'transient'`. Resposta 2xx com `text/html` (fallback da SPA respondendo `/api` sem API atrás) também vira `ApiError` `transient`. Sem fallback de dados.

## Desempenho (base do R2)

Base aplicada: fonte self-hosted com preload, code splitting por rota (`autoCodeSplitting` do TanStack Router) e MSW fora do chunk de entrada (import dinâmico; o chunk `browser-*` só existe com `VITE_ENABLE_MOCKS=true`).

Base do M2 para CLS e LCP (**ainda não medida**):

- **Dimensões fixas nas artes.** `NftCard` e `NftGallery` passam `width`/`height` do manifest (`nftArtSize`, `src/lib/nftArt.ts`) ao `<img>`, e o card usa `aspect-square`.
- **Skeletons com a mesma caixa da tela pronta.** `NftCardSkeleton` repete as alturas de linha do card; o `NftDetailSkeleton` compartilha as classes de `src/features/nft-detail/layout.ts`; o hero e o erro de destaques ocupam o mesmo tamanho. Medido em browser: caixas iguais entre skeleton e conteúdo em 390 e 1440 (Início e Detalhe). Skeletons usam `motion-reduce:animate-none`.
- **`fetchpriority="high"`** na arte do hero (Início) e na arte principal do Detalhe (`eager`); as demais ficam lazy.
- **Rota do Início em chunk próprio** (`dist/assets/routes-*.js`, ~28 kB), separada do `start-*.js`.

Pendente: AVIF/WebP (as artes ainda são SVG, ver "Substituição de assets"), LCP/CLS/TBT e medição com Lighthouse, que fecham o R2 no M5. Uma consequência conhecida do CLS: na primeira carga a paginação aparece só depois dos dados e empurra as promos para baixo. Scripts `test:e2e` e `lighthouse` entram no M5.

## Seções do enunciado (§12) a preencher

> Os títulos abaixo seguem o que o enunciado exige no ARCHITECTURE.md. **Contratos**, **Sessão** (mock e base do cliente), **Telas do M2**, **Cache**, **Desvios do Figma**, **Decisões de UX** e **Ajustes de acessibilidade** estão documentados até o M2; **Carrinho** documenta só o mock (M1); **Reconciliação** e o restante ainda são `TODO` e não estão implementados.

### Contratos

Os tipos ficam em `src/contracts` (`nft`, `quote`, `order`, `session`, `cart`, `favorite`, `profile`, `wallet`, `errors`, `events`, `health`, `common`, `money`); o endpoint e o verbo de cada request estão em comentário acima do tipo. Base: `API_URL` (`/api` por padrão). Toda resposta de erro tem o formato `ApiErrorBody` (`{ code, message, fieldErrors? }`).

**Convenções comuns.** "Auth: sim" = `Authorization: Bearer <token>`; sem token, token desconhecido ou expirado responde 401 `unauthorized`. As rotas podem, além dos erros listados, responder a falha do cenário ativo (`offline`, 503 `transient`; ver README) e, nas rotas que leem corpo, 422 `validation` quando o corpo não é um JSON objeto. Rota sem handler não é respondida pelo mock (`onUnhandledRequest: 'bypass'`).

| Método | Rota | Auth | Sucesso | Erros |
| -- | -- | -- | -- | -- |
| GET | `/health` | não | 200 `HealthStatus` | falha do cenário |
| POST | `/auth/signup` | não | 201 `AuthResponse` | 422 (nome, e-mail, senha de 8+); 409 e-mail já usado (ou `signup-conflict`) |
| POST | `/auth/login` | não | 200 `AuthResponse` | 422 (campos vazios); 401 e-mail ou senha inválidos |
| GET | `/auth/session` | sim | 200 `Session` | 401 |
| POST | `/auth/logout` | não | 204 | nenhum (idempotente: token ausente, desconhecido ou expirado também dá 204) |
| GET | `/nfts` | não | 200 `Paginated<Nft>` (filtros em `NftListParams`, abaixo) | 422 (parâmetros inválidos) |
| GET | `/nfts/featured` | não | 200 `Nft[]` (os `featured`, mais recentes primeiro) | nenhum |
| GET | `/nfts/facets` | não | 200 `NftFacets` (`collections` e `networks` com contagem, `price` com `min`/`max`; calculadas sobre o catálogo **inteiro**, não dependem dos filtros aplicados) | nenhum |
| GET | `/nfts/:nftId` | não | 200 `Nft` | 404 |
| GET | `/favorites` | sim | 200 `Favorite[]` | 401 |
| PUT | `/favorites/:nftId` | sim | 200 `Favorite` (idempotente: repetir devolve o existente) | 401; 404 NFT inexistente |
| DELETE | `/favorites/:nftId` | sim | 204 (idempotente) | 401 |
| GET | `/profile` | sim | 200 `Profile` (com `wallets`) | 401 |
| PATCH | `/profile` | sim | 200 `Profile` | 401; 422 (`displayName` vazio ou > 60; `avatarUrl` que não seja data URL PNG/JPEG/WebP/GIF ou > 200 000 caracteres; `avatarUrl: ''` remove) |
| PUT | `/profile/password` | sim | 204 | 401; 422 (senha atual incorreta, nova com < 8 ou igual à atual) |
| GET | `/wallets` | sim | 200 `Wallet[]` | 401 |
| POST | `/wallets` | sim | 201 `Wallet` | 401; 422 (endereço `0x` + 40 hex, rede, apelido até 40); 409 carteira já conectada (mesma rede e endereço) |
| PATCH | `/wallets/:walletId` | sim | 200 `Wallet` | 401; 403 de outra conta; 404; 422 (apelido, papel; rebaixar a principal) |
| DELETE | `/wallets/:walletId` | sim | 204 (se era a principal, a primeira restante assume) | 401; 403; 404 |
| POST | `/wallets/:walletId/connect` | sim | 200 `Wallet` (não altera o estado) | 401; 403; 404; 409 carteira recusou (`wallet-rejected`) |
| GET | `/cart` | sim | 200 `Cart` | 401 |
| POST | `/cart/items` | sim | 201 `Cart` (soma à linha existente) | 401; 422 (`nftId`, `edition`, `quantity` inteira >= 1); 404 NFT ou edição inexistente; 409 acima do estoque |
| PATCH | `/cart/items/:nftId/:edition` | sim | 200 `Cart` (define a quantidade) | 401; 422; 404 item fora do carrinho; 409 acima do estoque |
| DELETE | `/cart/items/:nftId/:edition` | sim | 200 `Cart` (idempotente) | 401; 422 edição inválida |
| POST | `/cart/merge` | sim | 200 `Cart` (carrinho anônimo entra no da conta) | 401; 422 (`items` ausente ou linha inválida) |
| PUT | `/cart/coupon` | sim | 200 `Cart` (guarda o código normalizado; o status só sai na cotação) | 401; 422 código vazio |
| DELETE | `/cart/coupon` | sim | 200 `Cart` | 401 |
| POST | `/quotes` | sim | 201 `Quote` (sem corpo; cota o carrinho da conta) | 401; 422 carrinho vazio |
| POST | `/orders` | sim | 201 `Order` criado; 200 `Order` existente (mesma chave e payload) | 401; 422 (header `Idempotency-Key`, `quoteId`, `walletId`); 403 cotação ou carteira de outra conta; 404 cotação ou carteira inexistente; 409 (ver abaixo) |
| GET | `/orders` | sim | 200 `Order[]` da conta, mais recentes primeiro | 401 |
| GET | `/orders/:orderId` | sim | 200 `Order` | 401; 403 de outra conta; 404 |

Rotas do socket: `ws.link('<VITE_SOCKET_URL>/*')` (ver "Transporte de tempo real"), fora desta tabela.

**Catálogo (M2).**

- A rota separada que listava as coleções deixou de existir (MYK-1073): os nomes das coleções vêm de `GET /nfts/facets`. Chamar a rota antiga cai no fallback HTML da SPA, que o cliente trata como `transient`.
- `/nfts/featured` e `/nfts/facets` são registrados **antes** de `/nfts/:nftId`, senão `featured` e `facets` seriam lidos como id.
- `NftListParams`: `q` (busca em nome, coleção, criador e descrição), `collections` (repetido, `collections=a&collections=b`, ou separado por vírgula; o cliente envia repetido), `priceMin`/`priceMax` (decimais, comparados com `Big`), `network` (`ethereum`, `polygon`, `arbitrum`, `optimism`), `tab` (`all`, `new`, `trending`), `sort` (`newest`, `price_asc`, `price_desc`), `page` e `pageSize` (padrão 12, máximo 100). Valor fora do formato responde 422 com `fieldErrors`.
- `tab=new` = NFTs criados nos 14 dias anteriores ao mais recente do catálogo (`NEW_WINDOW_DAYS`); `tab=trending` = fração vendida das edições limitadas entre 50% (inclusive) e 100% (exclusive) (`TRENDING_MIN_SOLD`). Empate de ordenação resolvido por `id`.
- `Nft.images: string[]` é a galeria (`images[0]` é a capa e igual a `imageUrl`; nunca vazio). Hoje todo NFT tem 1 imagem, porque só existe uma arte por NFT (ver "Substituição de assets"); a galeria com miniaturas foi exercitada injetando 3 imagens no db do mock.
- `Nft.previousPrice?` é o preço "de" riscado (promoção); está em 4 NFTs do seed (`nft-002`, `nft-009`, `nft-014`, `nft-023`).
- Com o cenário `empty`, `GET /nfts` devolve `items: []` e `GET /nfts/facets` devolve listas vazias e `price: { min: '0', max: '0' }`. O seed normal soma 30 NFTs em 5 coleções (6 cada) e 4 redes (7, 9, 6 e 8), preço de 0.03 a 5.

**`ApiErrorCode` e quando sai.**

| Código | Status | Quando |
| -- | -- | -- |
| `validation` | 422 | Corpo ou parâmetro inválido; `fieldErrors` aponta o campo. Também carrinho vazio na cotação. |
| `unauthorized` | 401 | Sem token, token desconhecido ou expirado (`session-expired`) **e** login com credenciais erradas. As duas causas têm o mesmo código: o cliente distingue pela rota. |
| `forbidden` | 403 | Carteira, cotação ou pedido de outra conta. |
| `not_found` | 404 | NFT, carteira, cotação, pedido ou item de carrinho inexistente. |
| `conflict` | 409 | E-mail já usado; carteira duplicada ou recusada; estoque do carrinho; `Idempotency-Key` reutilizada com outro payload; cotação expirada ou já usada; itens da cotação mudaram. |
| `transient` | 503 | Só por cenário (`server-error`, `favorite-fail`). O cliente também mapeia sem resposta, timeout, 5xx, 408 e 429 para `transient`. |

**`Idempotency-Key` em `POST /orders`.** O header é obrigatório. A chave é escopada por conta (`<accountId>:<key>`; a mesma string em contas diferentes não colide) e o fingerprint do payload é `{ accountId, quoteId, walletId }`. Mesma chave e mesmo payload devolve o mesmo pedido com **200** (a primeira criação responde **201**), em qualquer status do pedido. Mesma chave com payload diferente responde 409. Sem chave conhecida, o pedido só é criado se a cotação for válida:

- cotação já usada por pedido que não esteja `declined` responde 409 (uma cotação de pedido recusado pode ser usada de novo);
- cotação expirada (5 min de validade) responde 409;
- a revalidação compara o snapshot com o estado atual e responde 409 com `fieldErrors` de chave `"<nftId>:<edition>"` (`Preço alterado de X para Y ETH.`, `Estoque insuficiente (restam N).`, `Item indisponível.`). O estoque considerado **desconta os pedidos `pending`** (o estoque só baixa na confirmação, mas o que já está prometido não pode ser vendido de novo);
- ao liquidar, se o estoque já não cobre o pedido, ele vira `declined` em vez de vender além do que existe.

**Eventos.** Formato e regras de entrega em "Transporte de tempo real". Para forçar duplicatas ou versões novas: `__kurioMock.duplicateLast()` e `__kurioMock.emit.*` (ver "Mock").

### Sessão

Parte do mock (implementada no M1):

- **Token opaco.** `POST /auth/login` e `/auth/signup` gravam em `db.sessions` um `crypto.randomUUID()` e respondem `{ token, expiresAt, account }`. O cliente envia `Authorization: Bearer <token>`. TTL de 24h; `session-expired` usa 15s.
- **Validação.** Token ausente, desconhecido, expirado ou de conta inexistente responde 401 `unauthorized`; recurso de outra conta responde 403 `forbidden`. `GET /auth/session` revalida; `POST /auth/logout` apaga a sessão e é idempotente.
- **Senha.** Armazenada como SHA-256 hex de `${salt}:${senha}` (sal aleatório de 8 bytes), nunca em texto. É um mock: não é proteção real. Troca em `PUT /profile/password`. Mínimo de 8 caracteres.
- **Persistência.** As sessões vivem no `MockDb`, então sobrevivem a refresh até expirar ou o db ser resetado.
- **Socket.** O token vai pela `query` na conexão (ver "Transporte de tempo real").

Base do cliente (M2, MYK-1073; só a leitura da sessão, sem telas de login):

- **Onde fica o token.** `localStorage`, chave `kurio:session`, valor `{ "token": string, "expiresAt": <ISO 8601> }` (`src/auth/sessionStorage.ts`: `readSession`, `writeSession`, `clearSession`, `getToken`, `clearStoredSession`). `readSession` devolve `null` para chave ausente, JSON ilegível, forma inválida ou `expiresAt` vencido, e nunca lança; storage bloqueado ou cheio só deixa a sessão sem persistir. O storage é injetável nos testes.
- **Injeção no Axios.** O interceptor de request do `apiClient` lê `getToken()` a cada chamada e envia `Authorization: Bearer <token>` (leitura síncrona e barata do `localStorage`).
- **401.** Numa request que **levou** token, o 401 chama `clearStoredSession()` e o callback registrado por `onUnauthorized(cb)` (`src/api/client.ts`). `src/app/start.tsx` registra o callback que invalida `['session']`. O callback existe para o `client.ts` não importar o `queryClient` (evita ciclo). 401 sem token (visitante) não limpa nada.
- **`useSession()`** (`src/auth/useSession.ts`) devolve `{ account, isAuthenticated, isPending }`. A query `['session']` (`GET /auth/session`) fica `enabled` só com token válido e tem `retry: false`. `isAuthenticated` exige token válido **além** de dado em cache, porque o react-query mantém o dado antigo quando o refetch dá erro; sem isso o 401 não deslogaria. `isPending` é `true` só enquanto há token e a sessão está sendo confirmada (o header mostra um skeleton nesse intervalo).
- **`?redirect=` (MYK-1061).** `login` e `signup` só aceitam `redirect` que seja caminho interno (`isInternalPath`, `src/lib/redirectSearch.ts`): precisa começar com `/`, não pode começar com `//` ou `/\`, não pode conter caracteres de controle (o parser de URL descarta TAB, LF e CR, então `/<TAB>/evil.example` viraria `https://evil.example/`) e, resolvido contra uma origem fictícia, tem de manter a origem. Qualquer outro valor vira `undefined`. `validateRedirectSearch` devolve sempre a chave `redirect`, pelo mesmo motivo do `validateSearch` do catálogo (o router mescla o search cru com o validado). O visitante que tenta favoritar e o link "Entrar" do header mandam `redirect=<href atual>`.
- **Quem escreve a sessão.** Nenhuma tela ainda: `writeSession` será chamado pelo login. Até lá, a receita do `README.md` ("Entrar pelo console") grava a sessão na mão. Quem fizer o login deve invalidar `['session']` depois do `writeSession`, porque o `enabled` da query é avaliado a cada render.
- **A sessão do mock vive no db do mock.** Trocar de cenário (ou `reset()`) reinicia o db e **apaga as sessões**: o token guardado em `kurio:session` passa a dar 401 e o primeiro request o limpa. Entre cenários, faça o login de novo.

> TODO (MYK-1050): telas de login/cadastro, expiração com retomada (voltar ao ponto em que o usuário estava), logout, troca de usuário e o socket abrindo com o token (a conexão ainda é anônima). As rotas `_authenticated` ainda são vazias.

### Carrinho

Parte do mock (implementada no M1); a UI é TODO (M3/M4).

- **Origem da verdade: o servidor.** Cada conta tem seu carrinho em `db.carts` (`GET /cart`). Itens são `{ nftId, edition, quantity }` (`edition`: `1/1`, `1/10`, `1/50`, `open`); a mesma linha soma ao adicionar e `PATCH` define a quantidade. Acima do `available` da edição responde 409.
- **Visitante -> usuário.** `POST /cart/merge` soma o carrinho anônimo ao da conta, limitando ao estoque e descartando linhas desconhecidas, esgotadas ou com quantidade inválida.
- **Cupom.** `PUT /cart/coupon` só guarda o código (maiúsculo); o status sai na cotação: `KURIO10` = `applied` (10%), `EXPIRED5` = `expired`, qualquer outro = `invalid`. Os cenários `coupon-invalid` e `coupon-expired` forçam o resultado de qualquer código.
- **Cotação com snapshot.** `POST /quotes` congela os preços unitários, calcula `subtotal`, `discount`, `networkFee` e `total` (ver "Valores em ETH"), grava em `db.quotes` e vale 5 min. Itens sem estoque suficiente entram em `issues: [{ kind: 'unavailable' }]` (o tipo também prevê `price_changed`, que o mock hoje não emite: a mudança de preço só aparece na revalidação do pedido).
- **Revalidação no pedido.** `POST /orders` compara o snapshot com o estado atual (preço e estoque descontando `pending`) e responde 409 com o motivo por item. Detalhes em "Contratos".
- **Estoque e carrinho.** O estoque só baixa quando o pedido vira `confirmed`; nesse momento sai do carrinho apenas a quantidade comprada.
- **Cenários `price-changed` e `sold-out`.** O NFT muda depois da cotação, no `POST /orders` (preço +0,01 ETH, ou edição esgotada) e só no **primeiro toque** do NFT desde o seed (um NFT com `versions` já existente não muda de novo), então refazer a cotação depois funciona.

> TODO (M4): limites de quantidade por usuário e a reconciliação do carrinho com eventos.

### Telas do M2: Início, Detalhe e moldura

**Moldura (`src/components/layout`, MYK-1074).** `__root.tsx` monta `SkipLink` > `SiteHeader` > `<main id="conteudo" tabIndex={-1}>` > `SiteFooter` > `MobileTabBar`. O **único** `<main>` do app é o do root (`MAIN_CONTENT_ID = 'conteudo'`); as rotas usam `<section>`/`<div>`. Landmarks: `header`, `nav` "Principal" (a partir de `md`), `nav` da tab bar (abaixo de `md`), `main`, `footer`. A tab bar mobile é fixa, com `h-16` mais `env(safe-area-inset-bottom)`; o `<main>` recebe `TAB_BAR_PADDING_CLASS` para o conteúdo não ficar atrás dela, e qualquer barra fixa nova no mobile precisa ficar acima dela. `SessionLink` concentra a regra visitante / logado / carregando (header e tab bar): visitante vê "Entrar" (`/login?redirect=<href>`), logado vê o nome e vai a `/profile`, e enquanto `isPending` há um skeleton. "Mercado" aponta para `/#catalogo`. O header tem a busca (`HeaderSearch`, `role="search"`): em mobile abre como faixa sob o header e Esc devolve o foco; enviar leva a `/?q=<texto>#catalogo`. O carrinho do header não tem badge (carrinho é M3/M4).

**Início (`/`, MYK-1075).** O estado do catálogo mora na URL e só nela (`src/lib/catalogSearch.ts`):

- Campos: `q`, `collections`, `priceMin`, `priceMax`, `network`, `tab` (`new` | `trending`), `sort` (`price_asc` | `price_desc`) e `page`. Os padrões (`tab=all`, `sort=newest`, página 1) **não** vão para a URL.
- Formato: o padrão do TanStack Router, que serializa em JSON (`?collections=["Neon Atlas","Aurora Drift"]`, `priceMax="3.5"`). A forma digitada à mão (`priceMin=0.5`, `page=2`) também é aceita. Uma alternativa seria um `parseSearch`/`stringifySearch` próprio, mas ele afeta todas as rotas; não foi feito.
- `validateCatalogSearch` descarta valor inválido, nunca lança, aceita número ou texto para `page`/preço, aceita `collections` como array ou texto separado por vírgula (sai aparado, sem duplicata e ordenado) e descarta os **dois** preços quando a faixa vem invertida. **Devolve toda chave, inclusive com `undefined`**: o router calcula `{ ...searchCru, ...searchValidado }`, então sem a chave explícita um `?page=abc` voltaria cru, a request sairia com 422 e o slider quebraria. Não "simplifique" isso (teste em `catalogSearch.test.ts`). Parâmetros desconhecidos (ex.: `scenario`) ficam na busca crua, e `toListParams` os ignora.
- `withFilter(prev, patch)` aplica o patch, **remove `page`** (mudança de filtro volta à página 1) e normaliza; `undefined` no patch remove o filtro. Links de catálogo filtrado (como o breadcrumb do Detalhe) usam `withFilter`, nunca query string montada à mão.
- **`CATALOG_PAGE_SIZE = 12`.** Com 9 itens a última linha do grid de 2 colunas (390 px) ficava com um card órfão; 12 fecha as linhas de 2 colunas (mobile) e de 3 (a partir de `md`). Efeito: o seed paginado tem 3 páginas, contra "1 2 3 4" no Figma desktop. `?page=` além do fim mostra "Página não existe" com link para a última.
- Filtros: o mesmo `CatalogFilters` serve à sidebar (a partir de `lg`) e ao drawer (abaixo de `lg`, inclui 768). Coleção, rede e aba aplicam na hora; o preço só no botão "Aplicar" (o rótulo do slider muda antes, a URL não). Contagens vêm de `GET /nfts/facets`.
- Estados: skeleton na primeira carga, grid esmaecido com `aria-busy` nos refetches (`keepPreviousData`), EmptyState "Nenhum NFT encontrado" com "Limpar filtros", ErrorState com retry no grid, e erros independentes para filtros e destaques (nenhum derruba a página).
- Blocos estáticos: hero com carrossel (`featured`; os dots seguem a quantidade de destaques, hoje 6), card "NFT em destaque", promos (`PromoCards`, "Explorar em alta" leva a `?tab=trending`) e "Diário da Cunhagem" (`MintJournal`).

**Detalhe (`/nfts/$nftId`, MYK-1076).**

- `?edition=` (`1/1`, `1/10`, `1/50`, `open`) guarda a edição escolhida e é trocado com `replace: true` e `resetScroll: false` (não enche o histórico). Valor que não é edição vale como ausente. Edição inexistente ou esgotada cai na primeira edição com estoque, na ordem dos chips, e mostra o aviso "Edição indisponível. Mostrando a edição X.". A quantidade **não** vai para a URL; fica no estado do painel, e é limitada ao estoque da edição por `clampEditionQuantity` (`src/features/nft-detail/edition.ts`; nome diferente de `clampQuantity` do `@/lib/quantity`, que tem outra assinatura). `validateSearch` devolve a chave `edition` sempre, pelo mesmo motivo do catálogo.
- Painel de compra: chips de edição, "N de M disponíveis", `QuantityStepper` (desabilitado sem edição; o `QuantityStepper` do kit **não** faz clamp sozinho), "Adicionar ao carrinho" (`OutOfScopeAction`, "Em breve"), favoritar e compartilhar (`OutOfScopeAction`). Com todas as edições esgotadas: selo "Esgotado" (ícone + texto) e botão desabilitado.
- Galeria: miniaturas só quando há mais de 1 imagem (hoje nenhuma); `aria-pressed`, setas ←/→ trocam com volta circular e levam o foco. `PurchasePanel` e `NftGallery` remontam por `key={nft.id}`.
- "Mais desta coleção": `nftListQuery({ collections: [coleção], pageSize: 5 })` sem o NFT atual, até 4 itens (`NftGrid size="carousel"`); a seção some se não há outros. É uma grade de 2 colunas (4 a partir de `md`), não um carrossel de rolagem.
- Mobile: `MobileScreenHeader` com "Voltar" (`useCanGoBack`: `history.back()`, ou `/` quando a página foi aberta direto) e `MobilePurchaseBar` (preço + "Adicionar ao carrinho") **`sticky`** acima da tab bar. Sticky e não `fixed`: gruda enquanto o conteúdo rola e volta ao fluxo no fim da rota, então não cobre o fim do conteúdo nem o footer e não exige padding extra no `<main>`.
- Estados da rota: skeleton (mesmas classes de `layout.ts`), "NFT não encontrado" (`/nfts/nao-existe`, título "NFT não encontrado · Kurio") e erro com retry. Título da página: `<nome> · Kurio`.

### Cache

Política por recurso do M2 (as fábricas ficam em `src/api/nfts.ts`, `src/api/favorites.ts` e `src/auth/useSession.ts`; todas devolvem `queryOptions` e repassam o `signal`):

| Chave | Fábrica | Política |
| -- | -- | -- |
| `['nfts', 'list', params]` (`nftKeys.list`) | `nftListQuery(params)` | `placeholderData: keepPreviousData`: ao trocar filtro ou página, a lista anterior fica na tela (esmaecida, `aria-busy`) até a nova chegar. O `params` é o objeto da URL, então a mesma seleção usa a mesma chave. |
| `['nfts', 'detail', id]` (`nftKeys.detail`) | `nftDetailQuery(id)` | Sem retry em `not_found` (404 não melhora); qualquer outro erro tenta mais 1 vez. |
| `['nfts', 'featured']` | `featuredNftsQuery()` | Padrão (30s, 1 retry). |
| `['nfts', 'facets']` | `nftFacetsQuery()` | Padrão. As contagens não dependem dos filtros, então a chave não tem parâmetros. |
| `['favorites', accountId]` (`favoriteKeys.list`) | `favoritesQuery(accountId)` | Isolada por conta: trocar de usuário nunca reaproveita o cache do anterior. Só roda logado. |
| `['session']` | `sessionQuery()` | `retry: false`, `enabled` só com token (ver "Sessão"). |

`nftKeys.all` (`['nfts']`) invalida tudo do catálogo de uma vez.

**Resposta obsoleta.** A chave da query é a identidade do dado: uma resposta só entra no cache da chave que a pediu, então a lista de uma seleção antiga nunca aparece no lugar da atual. Complementa isso o `signal` repassado ao Axios: ao trocar de chave com a request antiga em voo, o react-query aborta a antiga. Para isso funcionar o cancelamento precisa chegar intacto ao react-query: o interceptor de resposta do `apiClient` repassa `CanceledError` como está (`isCancel`, MYK-1062) em vez de convertê-lo em `ApiError` `transient`, que viraria "erro" e dispararia retry. Verificado no cenário `jitter` (300 ms a 7 s): cinco trocas de aba a 120 ms terminam na aba clicada por último, com o grid igual à resposta daquela aba.

**Loader do Início: só prefetch.** O loader de `/` chama `prefetchQuery` sem `await` (lista, destaques e facetas; troca de filtro não espera o loader) e a lista é lida por `useQuery` no componente. Não usa `ensureQueryData`: com `/?scenario=offline` o loader lançava, o TanStack substituía a rota inteira pelo erro padrão ("Something went wrong!") e sumiam header da página, hero, sidebar e o retry. Com prefetch + `useQuery` o erro fica restrito ao grid (e à sidebar/hero, cada um com o seu estado). O hover em links para `/` continua aquecendo o cache (`defaultPreload: 'intent'`).

**Loader do Detalhe: `ensureQueryData`.** `/nfts/$nftId` usa `ensureQueryData(nftDetailQuery(id))` e o componente lê com `useSuspenseQuery`. `ApiError` `not_found` vira `notFound()` (página "NFT não encontrado", uma única request, sem retry); o resto é relançado e cai no `errorComponent` com "Tentar novamente" (`router.invalidate()`). `pendingMs` fica no padrão do router (1000 ms e `pendingMinMs` 500 ms): o skeleton do Detalhe aparece em `slow` (4 s) e **não** aparece no cenário `default`, nem na navegação nem no acesso direto; um valor menor arriscaria piscar com o `jitter`.

**Favoritos otimistas** (`src/features/favorites/favoriteCache.ts`, `favoriteMutationOptions`; é a única mutação otimista do M2):

1. `onMutate`: cancela refetch em voo de `['favorites', accountId]`, guarda o snapshot e aplica o toggle no cache (`applyFavoriteToggle`: idempotente, não muta a entrada).
2. `onError`: restaura o snapshot (sem snapshot, desfaz o toggle, porque `setQueryData(k, undefined)` não faz nada) e mostra o toast "Não foi possível atualizar os favoritos." (`FAVORITE_FAILURE_MESSAGE`).
3. `onSettled`: invalida `['favorites', accountId]` para reconciliar com o servidor, mas só quando `isMutating({ mutationKey }) <= 1`, isto é, no último clique a terminar.
4. `scope: favorite:<conta>:<nft>`: os cliques seguidos no mesmo NFT saem em série, então o servidor termina no estado do último clique. O `onMutate` roda na hora mesmo com o scope.
5. O estado exibido (`aria-pressed`) vem **sempre do cache** (`useToggleFavorite`), lido no momento do clique, não do render. O botão fica desabilitado enquanto a sessão ou a lista de favoritos carrega (sem a lista não há como saber o estado atual).
6. Visitante: o clique leva a `/login?redirect=<href atual>`. Se o 401 chegar no meio, o cliente limpa a sessão e o botão volta a agir como visitante.

Testado com `QueryClient` real, sem React (`favoriteCache.test.ts`): o otimista aparece antes da request resolver, a rejeição restaura o snapshot e chama `onFailure` uma vez, o sucesso mantém o otimista e invalida, e cliques em sequência fazem requests em série com um único invalidate.

> TODO (M4): `staleTime`/invalidação por evento do socket (preço e estoque em tempo real), reconciliação do carrinho e a mutação do carrinho. Os eventos ainda não tocam o cache.

### Reconciliação

> TODO (M4): descarte por `version`, dedupe por `eventId` e `invalidateQueries` na reconexão. Ainda não implementado.

### Limitações conhecidas

- **Mock: uma aba por vez.** Cada aba tem o próprio store em memória sobre o mesmo `localStorage` e grava o db inteiro a cada `mutate`; a última gravação vence, então uma aba pode apagar sessões e pedidos criados em outra. O socket do mock também é por aba (o bus não cruza abas). Verificações entre contas (ex.: `order.updated` só para o dono) devem ser feitas na mesma aba, trocando o token. Sincronizar via evento `storage` é decisão de produto e fica como follow-up.
- **Mock: quota do `localStorage`.** Se a gravação falhar (cheio ou bloqueado), o mock emite um `console.warn` (uma vez por store) e o estado passa a viver só em memória.

> TODO (M6): consolidar. Por enquanto valem as limitações do transporte de tempo real acima e o deploy na Vercel pendente.

### Desvios do Figma

> **Pendente de conferência visual.** O MCP do Figma (arquivo `nF8eQ49mVgxZGc8S1i36Q4`) recusou `get_screenshot` e `download_assets` por limite de chamadas do plano Starter em **todas** as tasks do M2 (MYK-1059, 1074, 1075, 1076). Nenhuma tela foi comparada com o Figma por imagem: o layout seguiu as descrições e os node IDs das issues. Tudo marcado abaixo como **pendente** precisa de `get_screenshot` em 390, 768 e 1440 quando houver cota.

**Desvios deliberados (por limite do contrato ou por decisão):**

- **Solana não existe no contrato.** `Network` tem 4 redes (`ethereum`, `polygon`, `arbitrum`, `optimism`); o filtro de rede e as contagens (`networks` das facetas) cobrem só elas.
- **Nomes das coleções vêm das fixtures** (5 coleções com 6 NFTs), não dos textos do Figma.
- **Badge de avaliação omitido** no Detalhe mobile (`15:5690`): o contrato não tem nota.
- **`pageSize` 12** em vez dos 9 do mobile: ver "Telas do M2". O seed pagina em 3 páginas, e não "1 2 3 4" como no Figma desktop.
- **Dots do hero** seguem a quantidade de destaques (6), não os 3 do Figma.
- **Drawer de filtros abaixo de `lg`** (inclui 768); a sidebar só aparece a partir de 1024. O rótulo "Ordenar por:" fica `sr-only` abaixo de `sm`.
- **Favorito no card só no mobile** (`md:hidden`): no desktop o card não tem coração; o Detalhe tem o botão em qualquer largura.
- **Breadcrumb do Detalhe escondido no mobile**, que usa o header de tela com "Voltar".
- **"Mais desta coleção" é grade** (2 colunas, 4 a partir de `md`), não carrossel horizontal.
- **Campo da newsletter do footer** é um `OutOfScopeAction` estilizado como input (não é `<input>`), para nada aparentar funcionar.
- **Galeria com 1 imagem** por NFT até haver artes reais (sem miniaturas).
- **Ações sem fluxo** ("Adicionar ao carrinho", Compartilhar, Criadores, Aprenda, links do footer, "Ler mais") usam `OutOfScopeAction` ("Em breve"); ver "Decisões de UX".

**Escolhas minhas, pendentes de conferência contra o Figma:**

- **Itens da tab bar mobile** (`14:5226`): Início, Mercado, Carrinho, Criadores (fora de escopo) e Conta, sem botão central destacado.
- **Footer** (`2:2`): textos dos 3 destaques institucionais, e-mail e telefone de contato (`contato@kurio.example`, `+55 (11) 4000-0000`), nomes das 4 colunas de links e o slogan são placeholders; o logo é o texto "KURIO", sem SVG.
- **Hero, promos e "Diário da Cunhagem":** os textos foram escritos na implementação (títulos, chamadas, as 3 matérias e as datas) e a escolha das artes de cada post. O card "NFT em destaque" reaproveita o `NftCard` com o badge "Oferta limitada".
- **Logos de MetaMask, WalletConnect e Coinbase:** não exportados; o `WalletOption` usa monograma (letra sobre a cor da marca).
- **Artes dos NFTs:** continuam as SVGs placeholder; AVIF/WebP e a troca pelas ilustrações do Figma estão pendentes (ver "Substituição de assets").
- **Conferência de `/dev/kit`, Início (`14:5226`), Detalhe desktop (`10:244`) e mobile (`15:5536`):** só contra descrições.

### Decisões de UX

- O app é **dark-only**, conforme o Figma. Aplicado no tema (ver "Tema").

**Ações fora de escopo: `OutOfScopeAction` ("Em breve"), confirmada no M2.** Valeu para Criadores, Aprenda, o footer, "Ler mais" do Diário, Compartilhar e "Adicionar ao carrinho" do Detalhe. Detalhes e motivo no parágrafo seguinte (MYK-1059).

**"Adicionar ao carrinho" fica "Em breve" até a MYK-1051** (carrinho, checkout e confirmação). No Detalhe ele só aparece no painel a partir de `md`; no mobile fica na barra de compra. Com tudo esgotado vira um botão desabilitado "Esgotado".

**Favoritar é funcional (contraria a tabela da MYK-1059).** A tabela da MYK-1059 listava o favorito como fora de escopo; o enunciado (§3) exige favoritos, então o `NftCard` ganhou `favorited` + `onFavoriteToggle` (botão irmão do link) e o Detalhe usa o `FavoriteButton`. Ver "Cache" para o comportamento otimista.

**Rótulo do favorito: fixo "Favoritar <nome>" + `aria-pressed` (a confirmar).** A issue MYK-1076 pede o rótulo alternado ("Favoritar" / "Remover dos favoritos") **junto** com `aria-pressed`. Isso não foi aplicado, de propósito: no padrão de botão de alternância do APG (WAI-ARIA Authoring Practices, *Button*), o rótulo **não muda** com o estado, porque o estado já é comunicado por `aria-pressed`; trocar o nome e manter `aria-pressed` faria o leitor de tela anunciar o estado duas vezes, e de forma contraditória ("Remover dos favoritos, pressionado"). O resultado da ação é anunciado numa região `aria-live="polite"` ("Adicionado aos favoritos." / "Removido dos favoritos."), e a falha só pelo toast, que o sonner já anuncia. Mesma escolha do kit na MYK-1059. **Precisa de aprovação do humano.** Se preferir o rótulo alternado, a mudança é pequena no kit (`FavoriteButton`: o nome passaria a ser "Remover dos favoritos" quando ativo, e `aria-pressed` sairia). Custo conhecido: existe um `<span aria-live>` por card favoritável (12 por página), vazios até a ação.

**Catálogo:**

- **Contagens das facetas não dependem dos filtros** (vêm do catálogo inteiro). Escolha simples e estável: o número ao lado da coleção não muda enquanto o usuário filtra. O custo é que "Neon Atlas (6)" pode resultar em menos de 6 NFTs com outro filtro ativo.
- **Preço aplicado só no "Aplicar".** O rótulo do slider acompanha o arrasto, a URL e a request não: evita uma request por passo de 0,01 ETH.
- **Mudança de filtro, ordenação, busca ou aba zera a página** (`withFilter` remove `page`). Paginar mantém os filtros.
- **A URL é a fonte do estado:** refresh, voltar/avançar e link compartilhado reproduzem a mesma tela (verificado). "Limpar filtros" volta a `/`.
- **"Diário da Cunhagem" é estático**, com "Ler mais" fora de escopo (§3); os textos são de layout, não dados de negócio.

**Detalhe:**

- **Edição na URL (`?edition=`) com `replace`:** link compartilhável sem poluir o histórico; edição inválida ou esgotada cai no padrão com aviso (texto + ícone).
- **Quantidade fora da URL** e limitada ao estoque da edição.
- **Barra de compra do mobile `sticky`** acima da tab bar (ver "Telas do M2").
- **"Voltar" do header mobile** usa o histórico quando existe e vai para `/` quando a página foi aberta direto.
- **Estados nunca só por cor:** esgotado, indisponível e erro têm texto e/ou ícone.

**Ações fora de escopo: desabilitado + tooltip "Em breve" (MYK-1059).** Escolhido em vez de uma página "em breve": não cria rota sem conteúdo nem dá impressão de sucesso funcional. `OutOfScopeAction` (`src/components/kurio/OutOfScopeAction.tsx`) é o único jeito de renderizar essas ações (Criadores/Aprenda, footer, itens da sidebar da conta, "Esqueceu a senha?", login social, Compartilhar, Etherscan). Usa `aria-disabled` em vez de `disabled`, para continuar focável por Tab: o tooltip abre com foco e com hover, o clique é ignorado e o nome acessível ganha o sufixo "(em breve)". Em menus (`WalletCard`) a mesma regra vira item desabilitado com "Em breve" ao lado. **Favoritar não é fora de escopo** (decisão 3 da MYK-1049): `FavoriteButton` é um toggle real com `aria-pressed`, e no `NftCard` fica fora do link do card (irmão posicionado sobre a arte) para não aninhar interativos.

**Cupom no Pagamento: o link expande o próprio `CouponInput` (MYK-1059, revisável).** No Figma do Pagamento desktop o cupom é só o link "Tem um código promocional? Aplique aqui" (`I70522:3321;70504:3154`), sem o que acontece ao clicar. O `CouponInput` com `collapsible` começa como esse link e, ao clicar, mostra o campo no lugar (foco no input), sem componente novo; fora do estado vazio ele já abre expandido. Se o cupom já foi aplicado no Carrinho, o Pagamento mostra só a linha de desconto no `PriceSummary`. No Carrinho (desktop e mobile) o campo aparece direto (input + botão).

### Substituição de assets

Registro dos assets do Figma substituídos (imagens, ícones, fontes) e o motivo. Fonte: só a Roboto Mono foi adicionada, self-hosted. Os `.woff2` de `public/fonts/` foram copiados do pacote `@fontsource/roboto-mono` 5.3.0 (licença OFL-1.1); a devDependency fica como origem dos arquivos. TODO: `public/favicon.svg` ainda é o do template do Vite; trocar pela marca do Kurio.

**Artes dos NFTs (MYK-1059).** O plano era exportar as ilustrações do Figma (nodes do Início `4:137`, `4:162`, `4:164`, `4:280`–`4:291`, destaque `70410:3798`, promos `4:428`/`4:423`, Detalhe `11:1161` e miniaturas `11:1181`–`11:1190`) e convertê-las para AVIF + WebP em dois tamanhos (~300px card, ~800px detalhe). Em 31/10 o MCP do Figma recusou `get_screenshot` e `download_assets` por limite de chamadas do plano Starter, então **as artes continuam sendo as 30 SVGs placeholder geradas no M1** (`public/nfts/<slug>.svg`, gradiente + formas, `viewBox` 120×120, ~530 bytes cada; nenhum asset de terceiros). O manifest `src/lib/nftArt.ts` (`NFT_ART_MANIFEST`, `nftArtSize`) registra as dimensões reais de cada arquivo; o `NftCard` passa `width`/`height` ao `<img>` (CLS) e `priority` liga `fetchpriority="high"` na arte acima da dobra. `src/lib/nftArt.test.ts` confere o manifest contra os arquivos do disco e contra as `imageUrl` das fixtures. Os logos de MetaMask, WalletConnect e Coinbase também não foram exportados: o `WalletOption` usa monograma (letra sobre a cor da marca).

> **Pendente (precisa de cota no Figma):** exportar as artes reais, gerar AVIF/WebP nos dois tamanhos, atualizar o manifest e as `imageUrl` das fixtures, trocar os monogramas pelos logos e fazer a conferência visual de `/dev/kit` contra o Figma em 390, 768 e 1440 com `get_screenshot` (não feita: a página foi conferida só contra as descrições e node IDs da MYK-1059).

### Ajustes de acessibilidade

Ajustes feitos no M2, verificados em browser (Tab, Esc, foco) e **não** auditados com leitor de tela nem com Lighthouse (M5). Contraste não foi medido.

- **Skip link e landmarks.** "Pular para o conteúdo" é o primeiro item do Tab e foca `main#conteudo` (o `SkipLink` intercepta o clique, porque o hash puro não move o foco de forma confiável com o router; o `<main>` tem `tabIndex={-1}`). Landmarks em "Telas do M2".
- **Ações fora de escopo continuam focáveis.** `OutOfScopeAction` usa `aria-disabled` (não `disabled`), o tooltip "Em breve" abre com foco e hover, o clique é ignorado e o nome acessível ganha "(em breve)".
- **Rótulos onde o Figma não tem.** A busca do header e o campo de busca têm nome ("Buscar NFTs"); os polos do slider de preço se chamam "Preço mínimo" e "Preço máximo" com `aria-valuetext` em ETH (prop `getThumbProps` do `ui/slider`); o botão do sheet diz "Fechar" (era "Close"); o carrinho do header tem `aria-label="Carrinho"`; o stepper de quantidade e os chips de edição têm nome e estado (`aria-disabled`, "Máximo: N").
- **Estados com texto, não só cor.** "Esgotado"/"Esgotada" (selo com ícone, `role="status"`), aviso de edição indisponível (ícone + texto), erros com `role="alert"` e botão "Tentar novamente".
- **`aria-live` no catálogo e nos favoritos.** O catálogo tem um `role="status"` "N NFTs encontrados" e `aria-busy` durante o refetch; o carrossel do hero tem uma região `aria-live` "Destaque n de N: nome" e dots com `aria-current`; o favorito anuncia "Adicionado aos favoritos." / "Removido dos favoritos." (ver "Decisões de UX"). O erro dos filtros **não** usa `role="alert"`, para não duplicar o anúncio do erro do grid.
- **Foco preso no drawer de filtros** (abaixo de `lg`): 30 Tabs seguidos nunca saem do dialog, Esc fecha e devolve o foco ao botão "Filtros (n)".
- **Navegação por teclado.** Paginação com `aria-label="Página n"` e `aria-current="page"`; busca do header com Esc devolvendo o foco; miniaturas da galeria com `aria-pressed` e setas ←/→; o chip esgotado é pulado no Tab (`disabled`); o título do header de tela mobile é `aria-hidden` porque o `h1` já está no conteúdo.
- **Hierarquia de títulos.** `h1` do hero (Início) ou do NFT (Detalhe), `h2` das seções (o "Catálogo" é `sr-only`), `h3` nos cards (o `NftCard` tem `<h3>` fixo).
- **Movimento.** Skeletons usam `motion-reduce:animate-none`.
- **Pendências:** foco visível e contraste contra o Figma não foram conferidos (sem cota); a tab bar mobile pode cobrir o fim do footer, porque o padding dela está no `<main>` e não depois do footer (observação da MYK-1076, ainda não verificada).
