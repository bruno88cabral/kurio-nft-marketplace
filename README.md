# Kurio - Marketplace de NFTs

Front-end do marketplace Kurio (desafio Jungle Gaming). Stack: React 19, Vite, TypeScript, TanStack Router/Query, Tailwind v4 + shadcn/ui, Axios, Socket.IO, MSW.

> Estado atual: **M0 (Fundação) + camada de mocks do M1 + M2 (Início e Detalhe do NFT)**. Existem o app shell (header, footer, tab bar mobile), o design system e o kit de componentes, os contratos tipados, a API mockada completa (MSW + Socket.IO, ver [Cenários](#cenários-de-mock-e-reset)), o **Início** (destaques, catálogo com busca, filtros, ordenação e paginação na URL), o **Detalhe do NFT** (galeria, edição, quantidade, "Mais desta coleção") e **favoritos** otimistas. Login, cadastro, perfil, carteiras, carrinho, checkout e o cache ligado ao tempo real (M3 em diante) ainda **não** existem; por enquanto a sessão se obtém pelo console ([receita](#entrar-pelo-console-até-as-telas-de-login)). As telas do M2 **não foram conferidas contra o Figma** (sem cota no MCP); ver "Desvios do Figma" no `ARCHITECTURE.md`. Tudo o que falta está marcado com `TODO`.

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

Com os mocks ligados, a rota `/` abre o Início com o catálogo do mock (30 NFTs, 12 por página). O painel de debug do spike do R1 foi removido na MYK-1075.

**Os mocks precisam de `VITE_ENABLE_MOCKS=true`.** O `.env.example` já traz esse valor e o `cp` acima o leva para o `.env.local`; sem esse arquivo o app abre sem API e o catálogo mostra o erro "Não foi possível carregar os NFTs.". Para subir sem arquivo: `VITE_ENABLE_MOCKS=true pnpm dev --port 5201 --strictPort`.

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
| `pnpm test` | `vitest run` (ambiente node, sem jsdom: `EthAmount`/`big.js`, interceptor do Axios e sessão, camada de mocks, estado do catálogo na URL, faixa de preço, edição e cache de favoritos). |

## Deploy (Vercel)

> TODO: deploy **pendente**. Nenhum deploy foi feito até aqui. O spike do R1 foi validado apenas em `pnpm build && pnpm preview` local (ver `ARCHITECTURE.md`). Passos para o humano:

1. Na Vercel: **Add New -> Project** e importar o repositório do GitHub.
2. Framework preset **Vite**, build command `pnpm build`, output directory `dist`. O `vercel.json` já tem o rewrite de SPA e o `pnpm-workspace.yaml` evita o erro de postinstall do `msw` no install.
3. Em Settings -> Environment Variables (Production e Preview): `VITE_ENABLE_MOCKS=true`, `VITE_API_URL=/api`, `VITE_SOCKET_URL=wss://realtime.kurio.mock`.
4. Fazer o deploy e conferir em aba anônima: o Início carregando o catálogo (30 NFTs, "Filtros" e paginação); refresh direto em `/nfts/nft-001` e `/cart` carregando a SPA; `/nfts/nao-existe` mostrando "NFT não encontrado"; `/mockServiceWorker.js` respondendo JavaScript. **A checagem do socket mudou:** o painel que mostrava `socket: connected` e o `nft.updated` saiu na MYK-1075 e nenhuma tela escuta o socket ainda; por isso o R1 segue só parcialmente mitigado. Em produção, verificar no console do navegador que não há erro de WebSocket (`wss://realtime.kurio.mock`) e deixar a prova de `nft.updated` para o M4, quando o cache passar a consumir os eventos.

## Documentação

- [`ARCHITECTURE.md`](./ARCHITECTURE.md): estrutura, decisões do M0, a camada de mocks (contratos de cada endpoint, sessão, carrinho, socket), o M2 (catálogo na URL, Detalhe, cache e favoritos otimistas, base da sessão no cliente, desvios do Figma, decisões de UX e acessibilidade) e o esqueleto das seções que serão preenchidas.

## Credenciais fictícias

Com os mocks ligados (`VITE_ENABLE_MOCKS=true`) existem dois usuários, ambos com a mesma senha:

| Usuário | E-mail | Senha | Carteiras |
| -- | -- | -- | -- |
| Ana Souza | `ana@kurio.test` | `Kurio#2026` | `wallet-ana-1` (Ethereum, principal). Favoritos: `nft-002` e `nft-009`. |
| Bruno Lima | `bruno@kurio.test` | `Kurio#2026` | `wallet-bruno-1` (Ethereum, principal) e `wallet-bruno-2` (Polygon). |

Os dois começam com carrinho vazio e nenhum pedido. Cupons: `KURIO10` (válido, 10%), `EXPIRED5` (expirado); qualquer outro código é inválido. Os dados são fictícios e a senha é só de mock.

### Entrar pelo console (até as telas de login)

As telas de login e cadastro são da MYK-1050; até lá, a sessão se obtém colando isto no console do navegador, com o app aberto na raiz (`http://localhost:5173/`, ou a porta que você usou) e os mocks ligados:

```js
const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'ana@kurio.test', password: 'Kurio#2026' }) }).then((r) => r.json())
localStorage.setItem('kurio:session', JSON.stringify({ token: r.token, expiresAt: r.expiresAt }))
location.reload()
```

Depois do reload o header mostra "Ana Souza" (no lugar de "Entrar") e os favoritos da Ana (`nft-002` e `nft-009`) aparecem marcados. O formato guardado é `{ "token": string, "expiresAt": <ISO 8601> }` na chave `kurio:session` (`src/auth/sessionStorage.ts`); sessão vencida, JSON ilegível ou fora desse formato conta como visitante. Para o Bruno, troque o e-mail por `bruno@kurio.test`. Para sair: `localStorage.removeItem('kurio:session'); location.reload()`.

**A sessão do mock vive no banco do mock:** trocar de cenário ou chamar `__kurioMock.reset()` reinicia o banco e **apaga as sessões**. Depois de trocar de cenário, rode a receita de novo (é o caso do `favorite-fail` abaixo). O cenário também fica salvo: depois de abrir `?scenario=slow`, as próximas cargas sem a query continuam em `slow`; volte com `?scenario=default`.

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

**Selecionar.** Abra o app com `?scenario=<nome>`, por exemplo `http://localhost:5173/?scenario=server-error`. O `?scenario=` vale se o nome existir, fica salvo em `kurio:mock-scenario` e vale nas próximas cargas sem a query. Trocar de cenário reinicia o banco do mock a partir do seed. Os métodos do hook recarregam a página já sem `?scenario=` na URL.

**Trocar e resetar pelo console** (`window.__kurioMock` só existe com mocks ligados; todos recarregam a página):

```js
__kurioMock.scenario                  // cenário ativo
__kurioMock.setScenario('sold-out')   // troca o cenário (o banco recomeça do seed se o cenário mudar)
__kurioMock.reset()                   // volta o banco ao seed, mesmo cenário
__kurioMock.reset('default')          // volta ao seed e troca para o default
```

**Limitação atual: uma aba por vez.** Cada aba tem o próprio estado sobre o mesmo `localStorage` e a última gravação vence; abrir duas abas do app pode apagar sessões e pedidos de uma delas, e o socket do mock também é por aba. Teste entre contas na mesma aba, trocando o token.

Nome de cenário inválido lança `Error` e não altera nada. Para zerar tudo na mão: apague `kurio:mock-db:v1` e `kurio:mock-scenario` do `localStorage` e recarregue.

**Eventos de tempo real** (cada um gera `eventId` e `version`; ainda não há tela que os mostre nem cache que os consuma, isso é do M4: o `emit` publica no mock, e a prova de entrega é o console do MSW):

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
14. **Evento duplicado.** Com a rota `/` aberta, rode `__kurioMock.emit.nftUpdated('nft-001', { price: '3' })` e depois `__kurioMock.duplicateLast()`: o mock publica o mesmo `eventId` e `version` duas vezes (visível no console do MSW; o app ainda não reage, M4). Cada `emit` seguinte traz uma `version` maior.
15. **Pedido de outra conta e sem autenticação.** Sem `token`, `await api('GET', '/orders')` devolve 401; com o token do Bruno (`await login('bruno@kurio.test')`), `GET /orders/<id de pedido da Ana>` devolve 403.

### Falhas do Início e do Detalhe (M2)

Estas receitas são pela **interface** (não precisam do helper acima). Todas com mocks ligados. Cenário novo = banco do mock reiniciado, então as que precisam de login pedem a receita [Entrar pelo console](#entrar-pelo-console-até-as-telas-de-login) de novo.

16. **Catálogo vazio (`empty`).** Abra `/?scenario=empty`. O grid mostra "Nenhum NFT encontrado" com o botão "Limpar filtros", o status diz "0 NFTs encontrados", a sidebar mostra "Nenhuma coleção" e o slider de preço fica desabilitado.
17. **Skeleton (`slow`).** Abra `/?scenario=slow` (4s por chamada). O grid mostra skeletons com a mesma caixa dos cards. Com o catálogo carregado, trocar de aba ("Em alta") ou de filtro deixa os cards atuais esmaecidos (`aria-busy`) até a resposta chegar. No Detalhe, `/nfts/nft-001?scenario=slow` mostra o skeleton "Carregando NFT…" depois de 1s; no cenário `default` o skeleton não aparece.
18. **Resposta fora de ordem (`jitter`).** Abra `/?scenario=jitter` (300ms a 7s por chamada) e troque de aba várias vezes seguidas (Novos lançamentos, Em alta, Todos). A tela termina na aba clicada por último, com o grid daquela aba, mesmo que uma resposta antiga chegue depois.
19. **Erro com retry (`offline` / `server-error`).** Abra `/?scenario=offline` ou `/?scenario=server-error`. Header, hero e filtros continuam na tela; o grid mostra "Não foi possível carregar os NFTs." com "Tentar novamente" (a sidebar e o hero têm o próprio erro). No Detalhe, `/nfts/nft-001?scenario=offline` mostra "Não foi possível carregar o NFT." com "Tentar novamente". O retry refaz a requisição, mas o cenário continua falhando; para ver a recuperação, abra `/?scenario=default` (o cenário só muda recarregando).
20. **NFT inexistente.** Abra `/nfts/nao-existe` (com `?scenario=default` se um cenário anterior ficou salvo): "NFT não encontrado" com o link "Voltar ao Início", título da aba "NFT não encontrado · Kurio" e uma única requisição.
21. **URL de catálogo inválida.** Abra `/?page=abc&tab=hot&priceMin=x&network=solana`: o Início ignora os valores inválidos e mostra os 12 primeiros NFTs. `/?page=9` mostra "Página não existe" com link para a última página. Em `/nfts/nft-017?edition=xyz` o valor é ignorado; `?edition=1/10` (esgotada nesse NFT) mostra o aviso "Edição indisponível. Mostrando a edição 1/50.".
22. **Favorito com rollback (`favorite-fail`).** Abra `/nfts/nft-002?scenario=favorite-fail`, rode a receita de login (o cenário apagou a sessão; ela recarrega a página) e clique em "Favoritar Solar Veil" (a nft-002 já vem favoritada no seed da Ana, então `aria-pressed` passa de `true` para `false` na hora). A requisição falha com 503: o botão volta para `true` e aparece o toast "Não foi possível atualizar os favoritos.". Como visitante, o mesmo clique leva a `/login?redirect=%2Fnfts%2Fnft-002`. No Início em 390 px de largura, o coração fica no canto do card (no desktop o card não tem coração).
23. **`?redirect=` externo.** Abra `/login?redirect=https://evil.example`: o valor é descartado (a URL fica `/login`). Só caminho interno (começando com `/`) é aceito.

## Testes E2E (Playwright)

> TODO (M5/M6): ainda não há Playwright configurado.

## Lighthouse

> TODO (M5/M6): ainda não foi medido.
