# Arquitetura

Documento vivo. Hoje cobre o **M0 (Fundação)** e a **camada de mocks do M1** (estado, handlers REST, socket e cenários): as decisões já tomadas e implementadas estão preenchidas; o que depende das telas e do cliente (M2 em diante) está como `TODO` e **não** deve ser lido como funcionando.

## Estrutura de pastas

```
src/
  api/          cliente HTTP (Axios) e normalização de erros em ApiError
  app/          bootstrap (start.tsx), router e QueryClient
  components/ui componentes shadcn/ui (estilo radix-vega)
  contracts/    contratos tipados de REST e eventos (fonte única)
  lib/          utilitários puros (cn, eth, redirectSearch)
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
- TODO (M4): o consumo de `formatEth` nas telas ainda não existe.

## Transporte de tempo real

Decisão: `@mswjs/socket.io-binding` sobre `ws.link` do MSW, com `socket.io-client` configurado com `transports: ['websocket']` e `autoConnect: false` (`src/realtime/socket.ts`). O socket é tipado com `Socket<ServerToClientEvents, ClientToServerEvents>`; `ClientToServerEvents` é `Record<string, never>` (o cliente não emite nada) e foi confirmado que compila com o `socket.io-client`.

O mock (`src/mocks/socket.ts`) assina o bus do estado (ver "Mock") e entrega `nft.updated` a todas as conexões e `order.updated` só ao dono do pedido. O emissor periódico do spike saiu; `window.__kurioMock` dispara eventos pelo estado.

- **Token da conexão: pela `query`.** O cliente deve abrir com `io(SOCKET_URL, { transports: ['websocket'], query: { token } })`; o token chega em `connection.client.url` (`...?token=<t>&EIO=4&transport=websocket`), validado no browser. O `auth` do Socket.IO só chega no pacote CONNECT (`40{"token":...}`), depois do handshake, e **não** é lido pelo mock. Sem token, ou com token inválido/expirado, a conexão é **anônima** e recebe só `nft.updated`.
- **A conta é resolvida uma vez, no connect.** Uma sessão que expira depois continua recebendo `order.updated`; quem faz login depois de conectar precisa reconectar o socket (nota para o M3/M4: reconectar no login e no logout).
- **Filtro por conta.** O evento do bus não carrega `accountId`; `shouldDeliver` (`src/mocks/db/delivery.ts`) consulta o dono em `db.orders[id].accountId`. O evento `reset` do bus não sai pelo socket.
- **Formato do evento** (`src/contracts/events.ts`): `{ eventId, resource: { type, id }, version, occurredAt, payload }`. `eventId` é UUID; `version` vem de `db.versions['<tipo>:<id>']`, é monotônica por recurso e persiste junto com o db; `reset()` zera as versões (por isso o hook recarrega a página). Payloads: `nft.updated` `{ id, price, editions }`, `order.updated` `{ id, status }`.
- Ao fechar a conexão o mock cancela a assinatura do bus e o heartbeat de 25s.

### Resultado do spike R1 (MYK-1057)

- **Validado em `pnpm build && pnpm preview` local** (Chrome headless via CDP): `GET /api/health` mockado, `socket: connected`, `nft.updated` a cada 5s, uma única conexão estável por 62s (12 eventos, sem reconexão).
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
- O painel de debug em `src/routes/index.tsx` é temporário (removido na MYK-1049).

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
  | `setScenario(nome)` | Valida, persiste o cenário e recarrega (o db recomeça do seed). |
  | `reset(nome?)` | Valida o nome, `store.reset()` (volta ao seed e zera `versions`), persiste o cenário se vier um e recarrega. |
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

`src/app/queryClient.ts`: `staleTime: 30_000` e `retry: 1` para queries. A intenção é evitar refetch a cada navegação e deixar o tempo real atualizar preço e estoque. São valores iniciais do M0.

TODO (M4): política por recurso, mutações, e a ligação dos eventos do socket ao cache. Hoje nenhum evento atualiza o cache. `withCredentials` no Axios entra com a sessão no M3.

## Tema

**Dark-only**, conforme o Figma. `@custom-variant dark (&:is(*))` mantém a variante `dark` sempre ativa e `color-scheme: dark` está no `src/index.css`. Tokens `--kurio-*` e variáveis do shadcn estão no mesmo arquivo; fonte Roboto Mono self-hosted com `preload` do peso 400 no `index.html`. A rota `/dev/tokens` existe só em DEV.

## Erros de API

`src/api/client.ts` exporta `apiClient`. O interceptor sempre lança `ApiError` (`src/contracts/errors.ts`). Sem resposta, timeout, 5xx, 408 e 429 viram `code: 'transient'`. Resposta 2xx com `text/html` (fallback da SPA respondendo `/api` sem API atrás) também vira `ApiError` `transient`. Sem fallback de dados.

## Desempenho (base do R2)

Base aplicada: fonte self-hosted com preload, code splitting por rota (`autoCodeSplitting` do TanStack Router) e MSW fora do chunk de entrada (import dinâmico; o chunk `browser-*` só existe com `VITE_ENABLE_MOCKS=true`). TODO (M5): imagens, LCP/CLS/TBT e medição com Lighthouse. Ainda não foi medido. Scripts `test:e2e` e `lighthouse` entram no M5.

## Seções do enunciado (§12) a preencher

> Os títulos abaixo seguem o que o enunciado exige no ARCHITECTURE.md. **Contratos**, a parte do mock em **Sessão** e **Carrinho** estão documentados (camada de mocks do M1); o restante ainda é `TODO` e não está implementado.

### Contratos

Os tipos ficam em `src/contracts` (`nft`, `quote`, `order`, `session`, `cart`, `favorite`, `profile`, `wallet`, `errors`, `events`, `health`, `common`, `money`); o endpoint e o verbo de cada request estão em comentário acima do tipo. Base: `API_URL` (`/api` por padrão). Toda resposta de erro tem o formato `ApiErrorBody` (`{ code, message, fieldErrors? }`).

**Convenções comuns.** "Auth: sim" = `Authorization: Bearer <token>`; sem token, token desconhecido ou expirado responde 401 `unauthorized`. Todas as rotas podem, além dos erros listados, responder a falha do cenário ativo (`offline`, 503 `transient`; ver README) e 422 `validation` quando o corpo não é um JSON objeto. Rota sem handler não é respondida pelo mock (`onUnhandledRequest: 'bypass'`).

| Método | Rota | Auth | Sucesso | Erros |
| -- | -- | -- | -- | -- |
| GET | `/health` | não | 200 `HealthStatus` | falha do cenário |
| POST | `/auth/signup` | não | 201 `AuthResponse` | 422 (nome, e-mail, senha de 8+); 409 e-mail já usado (ou `signup-conflict`) |
| POST | `/auth/login` | não | 200 `AuthResponse` | 422 (campos vazios); 401 e-mail ou senha inválidos |
| GET | `/auth/session` | sim | 200 `Session` | 401 |
| POST | `/auth/logout` | não | 204 | nenhum (idempotente: token ausente, desconhecido ou expirado também dá 204) |
| GET | `/nfts` | não | 200 `Paginated<Nft>` | 422 (parâmetros inválidos) |
| GET | `/nfts/featured` | não | 200 `Nft[]` | nenhum |
| GET | `/nfts/:nftId` | não | 200 `Nft` | 404 |
| GET | `/collections` | não | 200 `string[]` (nomes das coleções do catálogo, ordenados) | nenhum |
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

> TODO (M3/M4): onde o cliente guarda o token, como o injeta no Axios e no socket, e o que acontece ao expirar (as rotas `_authenticated` ainda são vazias).

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
