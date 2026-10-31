# Kurio - Marketplace de NFTs

Front-end do marketplace Kurio (desafio Jungle Gaming). Stack: React 19, Vite, TypeScript, TanStack Router/Query, Tailwind v4 + shadcn/ui, Axios, Socket.IO, MSW.

> Estado atual: **M0 (Fundação) + camada de mocks do M1**. O app shell, o design system, os contratos tipados, o spike de tempo real e a API mockada completa (MSW + Socket.IO, ver [Cenários](#cenários-de-mock-e-reset)) existem. As telas e os fluxos de negócio (M2 em diante) ainda **não** existem. Tudo o que depende deles está marcado com `TODO`.

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
| `VITE_SOCKET_URL` | `wss://realtime.kurio.mock` | Host do Socket.IO. O mock responde neste host (`ws.link`). Se não for definida, o padrão `wss://realtime.kurio.mock` (`src/app/env.ts`) vale tanto para o cliente (`src/realtime/socket.ts`) quanto para o `ws.link` do mock, que nunca divergem. |

## Comandos

| Comando | O que faz |
| -- | -- |
| `pnpm dev` | Servidor de desenvolvimento (Vite). |
| `pnpm build` | `tsc -b && vite build`. Saída em `dist/`. |
| `pnpm preview` | Serve o build de produção localmente. |
| `pnpm typecheck` | `tsc -b`. |
| `pnpm lint` | `eslint .`. |
| `pnpm test` | `vitest run` (`EthAmount`/`big.js`, interceptor do Axios e a camada de mocks: banco, cenários, regras de carrinho/cotação/pedido e filtro do socket). |

## Deploy (Vercel)

> TODO: deploy **pendente**. Nenhum deploy foi feito até aqui. O spike do R1 foi validado apenas em `pnpm build && pnpm preview` local (ver `ARCHITECTURE.md`). Passos para o humano:

1. Na Vercel: **Add New -> Project** e importar o repositório do GitHub.
2. Framework preset **Vite**, build command `pnpm build`, output directory `dist`. O `vercel.json` já tem o rewrite de SPA e o `pnpm-workspace.yaml` evita o erro de postinstall do `msw` no install.
3. Em Settings -> Environment Variables (Production e Preview): `VITE_ENABLE_MOCKS=true`, `VITE_API_URL=/api`, `VITE_SOCKET_URL=wss://realtime.kurio.mock`.
4. Fazer o deploy e conferir em aba anônima: painel da rota `/` com o `health` mockado, `socket: connected` e um `nft.updated` aparecendo ao rodar `__kurioMock.emit.nftUpdated('nft-001', { price: '3' })` no console; refresh direto em `/nfts/abc` e `/cart` carregando a SPA; `/mockServiceWorker.js` respondendo JavaScript.

## Documentação

- [`ARCHITECTURE.md`](./ARCHITECTURE.md): estrutura, decisões do M0, a camada de mocks (contratos de cada endpoint, sessão, carrinho, socket) e esqueleto das seções que serão preenchidas.

## Credenciais fictícias

Com os mocks ligados (`VITE_ENABLE_MOCKS=true`) existem dois usuários, ambos com a mesma senha:

| Usuário | E-mail | Senha | Carteiras |
| -- | -- | -- | -- |
| Ana Souza | `ana@kurio.test` | `Kurio#2026` | `wallet-ana-1` (Ethereum, principal). Favoritos: `nft-002` e `nft-009`. |
| Bruno Lima | `bruno@kurio.test` | `Kurio#2026` | `wallet-bruno-1` (Ethereum, principal) e `wallet-bruno-2` (Polygon). |

Os dois começam com carrinho vazio e nenhum pedido. Cupons: `KURIO10` (válido, 10%), `EXPIRED5` (expirado); qualquer outro código é inválido. Os dados são fictícios e a senha é só de mock.

## Cenários de mock e reset

O mock é a API do app (REST via MSW e Socket.IO mockado) e guarda o estado no `localStorage` (`kurio:mock-db:v1`), então ele sobrevive a refresh. Um **cenário** muda a latência, injeta falhas ou altera o resultado de uma regra. O padrão é `default`.

| Cenário | O que faz |
| -- | -- |
| `default` | Latência fixa de 150ms, tudo funciona. Pedido `pending` vira `confirmed` em 2,5s. |
| `empty` | Catálogo vazio (`GET /nfts` devolve `items: []`, `total: 0`). |
| `slow` | Toda requisição leva 4s (abaixo do timeout de 10s do cliente). |
| `jitter` | Latência aleatória de 300ms a 7s por requisição (PRNG com seed fixo, abaixo do timeout). |
| `offline` | Toda requisição falha como erro de rede (sem resposta HTTP). |
| `server-error` | Toda requisição responde 503 `transient` ("Serviço indisponível. Tente novamente."). |
| `session-expired` | O token emitido no login/cadastro vale só 15s; depois disso responde 401. |
| `signup-conflict` | `POST /auth/signup` sempre responde 409 (e-mail já usado). |
| `coupon-invalid` | Qualquer cupom é cotado como `invalid`, sem desconto. |
| `coupon-expired` | Qualquer cupom é cotado como `expired`, sem desconto. |
| `price-changed` | O preço do NFT sobe 0,01 ETH entre a cotação e o pedido; o `POST /orders` responde 409. |
| `sold-out` | A edição esgota entre a cotação e o pedido; o `POST /orders` responde 409. |
| `order-timeout` | A resposta que **cria** o pedido leva 12s (acima do timeout de 10s); o pedido existe e o retry com a mesma `Idempotency-Key` devolve o mesmo. |
| `payment-declined` | O pedido termina em `declined` em vez de `confirmed`. |
| `favorite-fail` | `PUT` e `DELETE /favorites/:nftId` respondem 503 `transient`. |
| `wallet-rejected` | `POST /wallets/:walletId/connect` responde 409 (a carteira recusa a conexão). |

**Selecionar.** Abra o app com `?scenario=<nome>`, por exemplo `http://localhost:5173/?scenario=server-error`. O `?scenario=` vale se o nome existir, fica salvo em `kurio:mock-scenario` e vale nas próximas cargas sem a query. Trocar de cenário reinicia o banco do mock a partir do seed.

**Trocar e resetar pelo console** (`window.__kurioMock` só existe com mocks ligados; todos recarregam a página):

```js
__kurioMock.scenario                  // cenário ativo
__kurioMock.setScenario('sold-out')   // troca o cenário (o banco recomeça do seed)
__kurioMock.reset()                   // volta o banco ao seed, mesmo cenário
__kurioMock.reset('default')          // volta ao seed e troca para o default
```

Nome de cenário inválido lança `Error` e não altera nada. Para zerar tudo na mão: apague `kurio:mock-db:v1` e `kurio:mock-scenario` do `localStorage` e recarregue.

**Eventos de tempo real** (cada um gera `eventId` e `version`; o painel de debug da rota `/` mostra o último `nft.updated`):

```js
__kurioMock.emit.nftUpdated('nft-001', { price: '3' })  // novo preço/estoque, version maior
__kurioMock.emit.orderUpdated('<orderId>')               // re-publica o status atual, version + 1
__kurioMock.duplicateLast()                              // reentrega o último evento (mesmo eventId e version)
```

## Reprodução de falhas

Cada receita usa só o navegador e o console, com o app aberto na raiz (`http://localhost:5173/`, `pnpm dev` com `VITE_ENABLE_MOCKS=true`, ou `pnpm preview`). O cliente HTTP do app usa `/api`; os `fetch` abaixo falam com a mesma base. Os resultados são `{ status, body }`.

**Passo 0: cole este helper no console depois de cada carga da página** (recarregar apaga as variáveis do console; o estado do mock não):

```js
const api = async (method, path, { token, body, key, timeoutMs } = {}) => {
  const res = await fetch('/api' + path, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(key && { 'Idempotency-Key': key }),
    },
    body: body && JSON.stringify(body),
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}
const login = async (email = 'ana@kurio.test') =>
  (await api('POST', '/auth/login', { body: { email, password: 'Kurio#2026' } })).body.token
```

**Preparar uma compra** (usado nas receitas de cupom, preço, estoque, timeout e pagamento). Comece cada receita numa carga limpa (`__kurioMock.reset()` ou `__kurioMock.setScenario(...)` recarregam a página e deixam o NFT intocado; recarregar também apaga as variáveis do console, então cole o helper e este bloco de novo). O bloco tem duas partes, a segunda só depois do cupom, se a receita usar um:

```js
const token = await login()
await api('POST', '/cart/items', { token, body: { nftId: 'nft-005', edition: 'open', quantity: 1 } })  // 201

// parte 2
let quote = (await api('POST', '/quotes', { token })).body                                         // 201
const order = (n = 'k1') => api('POST', '/orders', { token, key: n, body: { quoteId: quote.quoteId, walletId: 'wallet-ana-1' } })
```

1. **Erro de rede / offline.** Abra `/?scenario=offline`. No console: `await api('GET', '/health')` rejeita com `TypeError: Failed to fetch`. Na UI, qualquer chamada `/api` vira `ApiError` `transient` sem `status`.
2. **Erro 5xx.** Abra `/?scenario=server-error`. `await api('GET', '/health')` devolve `{ status: 503, body: { code: 'transient', message: 'Serviço indisponível. Tente novamente.' } }`.
3. **Lentidão e jitter.** Abra `/?scenario=slow` (4s por chamada) ou `/?scenario=jitter` (300ms a 7s). No console: `console.time('t'); await api('GET', '/health'); console.timeEnd('t')`. Nenhum passa de 10s, então não dá timeout no app.
4. **Catálogo vazio.** Abra `/?scenario=empty`. `(await api('GET', '/nfts')).body` tem `items: []` e `total: 0`.
5. **Sessão expirada.** Abra `/?scenario=session-expired`, cole o helper e rode `const token = await login(); await api('GET', '/auth/session', { token })` (200). Espere mais de 15s e repita a chamada: `{ status: 401, body: { code: 'unauthorized', ... } }`.
6. **Cadastro com e-mail já usado.** Duas formas: sem cenário, `await api('POST', '/auth/signup', { body: { name: 'Ana', email: 'ana@kurio.test', password: 'Kurio#2026' } })` já devolve 409; com `/?scenario=signup-conflict`, o mesmo 409 sai para **qualquer** e-mail novo.
7. **Cupom inválido ou expirado.** Sem cenário: `EXPIRED5` sai `expired` e `QUALQUER` sai `invalid`; `KURIO10` sai `applied` (10% de desconto). Com `/?scenario=coupon-invalid` ou `coupon-expired`, **qualquer** código (inclusive `KURIO10`) sai com aquele status. Receita: rode só a parte 1 de "Preparar uma compra", depois `await api('PUT', '/cart/coupon', { token, body: { code: 'KURIO10' } })` e `(await api('POST', '/quotes', { token })).body.coupon` mostra `{ code: 'KURIO10', status: 'invalid' }` com `discount: '0'`.
8. **Preço mudou entre cotação e pedido.** Abra `/?scenario=price-changed` (comece pelo `reset()`), faça o "Preparar uma compra" e rode `await order('k1')`: `{ status: 409, body: { code: 'conflict', fieldErrors: { 'nft-005:open': 'Preço alterado de 0.15 para 0.16 ETH.' } } }`. Cote de novo, reatribuindo a variável (`quote = (await api('POST', '/quotes', { token })).body`), e peça com outra chave (`await order('k2')`): sai 201 (o helper `order` usa o `quote` atual), porque o preço só muda no primeiro toque do NFT.
9. **Esgotou entre cotação e pedido.** Igual ao anterior com `/?scenario=sold-out`: `order('k1')` devolve 409 com `fieldErrors: { 'nft-005:open': 'Estoque insuficiente (restam 0).' }`. Uma nova cotação (`(await api('POST', '/quotes', { token })).body.issues`) já sai com `[{ nftId: 'nft-005', edition: 'open', kind: 'unavailable' }]`, e pedir com ela segue dando 409.
10. **Timeout do pedido e retry idempotente.** Abra `/?scenario=order-timeout`, faça o "Preparar uma compra" e rode `await api('POST', '/orders', { token, key: 'k1', timeoutMs: 10000, body: { quoteId: quote.quoteId, walletId: 'wallet-ana-1' } })`. Depois de 10s a chamada aborta (`TimeoutError`), mas o pedido já foi criado. Repita **a mesma chamada** com a mesma `key` (sem `timeoutMs`): volta rápido com **200** e o mesmo `id`, e `(await api('GET', '/orders', { token })).body` tem um único pedido. Chave nova com a mesma cotação dá 409 ("Esta cotação já foi usada em outro pedido.").
11. **Pagamento recusado.** Abra `/?scenario=payment-declined`, faça o "Preparar uma compra" e rode `const o = (await order('k1')).body` (201, `status: 'pending'`). Após ~2,5s `(await api('GET', '/orders/' + o.id, { token })).body.status` é `'declined'` (sem `txHash`, estoque intacto). No cenário `default` o mesmo fluxo termina `'confirmed'` com `txHash`.
12. **Favorito falhando.** Abra `/?scenario=favorite-fail`, rode `const token = await login(); await api('PUT', '/favorites/nft-001', { token })`: `{ status: 503, body: { code: 'transient', message: 'Não foi possível atualizar os favoritos.' } }`. O `DELETE` falha igual; `GET /favorites` continua funcionando.
13. **Carteira recusada.** Abra `/?scenario=wallet-rejected`, rode `const token = await login(); await api('POST', '/wallets/wallet-ana-1/connect', { token })`: `{ status: 409, body: { code: 'conflict', message: 'A carteira recusou a conexão. ...' } }`. Fora desse cenário a mesma chamada devolve 200 com a carteira.
14. **Evento duplicado.** Com a rota `/` aberta, rode `__kurioMock.emit.nftUpdated('nft-001', { price: '3' })` e depois `__kurioMock.duplicateLast()`: o cliente recebe o mesmo `eventId` e `version` duas vezes. Cada `emit` seguinte traz uma `version` maior.
15. **Pedido de outra conta e sem autenticação.** Sem `token`, `await api('GET', '/orders')` devolve 401; com o token do Bruno (`await login('bruno@kurio.test')`), `GET /orders/<id de pedido da Ana>` devolve 403.

## Testes E2E (Playwright)

> TODO (M5/M6): ainda não há Playwright configurado.

## Lighthouse

> TODO (M5/M6): ainda não foi medido.
