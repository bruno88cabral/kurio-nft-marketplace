# Kurio - Marketplace de NFTs

Front-end do marketplace Kurio (desafio Jungle Gaming). Stack: React 19, Vite, TypeScript, TanStack Router/Query, Tailwind v4 + shadcn/ui, Axios, Socket.IO, MSW.

> Estado atual: **M0 (Fundação) + camada de mocks do M1 + M2 (Início e Detalhe do NFT) + M3 (Conta e sessão) + M4 (Carrinho, checkout e tempo real)**. Existem o app shell (header, footer, tab bar mobile), o design system e o kit de componentes, os contratos tipados, a API mockada completa (MSW + Socket.IO, ver [Cenários](#cenários-de-mock-e-reset)), o **Início** (destaques, catálogo com busca, filtros, ordenação e paginação na URL), o **Detalhe do NFT** (galeria, edição, quantidade, "Mais desta coleção") e **favoritos** otimistas. O M3 trouxe **login e cadastro** (modais em `/login` e `/signup`), o menu da conta com **sair**, rotas protegidas que voltam ao lugar de origem, o **Perfil** (nome, avatar e troca de senha), as **Carteiras** (cadastrar, definir principal, renomear e remover) e o ciclo de vida da sessão (expiração, troca de conta, várias abas). O M4 trouxe o **carrinho** (do visitante em `localStorage` e da conta no servidor, com cupom e cotação), o **Pagamento** (formulário "Perfil do colecionador" validado no cliente, carteira cadastrada e rede, provedor com conexão, recusa e desconexão simuladas, revisão em diálogo, revalidação antes de confirmar e pedido idempotente), a **Confirmação** com o recibo e o **cache ligado ao tempo real** (`nft.updated` e `order.updated` com dedupe por `eventId` e descarte por `version`). Para entrar, use o [login pela interface](#entrar-e-sair); as receitas do M4 estão em [Falhas do carrinho, pagamento e tempo real](#falhas-do-carrinho-pagamento-e-tempo-real-m4). As telas do M2, do M3 e do M4 **não foram conferidas contra o Figma** (sem cota no MCP), exceto o **Pagamento**, conferido contra os PNGs exportados do Figma; ver "Desvios do Figma" no `ARCHITECTURE.md`. Tudo o que falta (M5 em diante) está marcado com `TODO`.

> TODO: a URL pública da Vercel ainda não existe. O projeto já faz deploy a cada push (ver [Deploy](#deploy-vercel)), mas os domínios da Vercel pedem login. Esta seção deve receber o link quando houver um domínio público.

## Requisitos

- Node 24.x (desenvolvido com 24.22)
- pnpm 12.x (desenvolvido com 12.8.1)

## Setup

```bash
pnpm install
pnpm dev
```

O dev server sobe em `http://localhost:5173` (porta padrão do Vite). Para outra porta: `pnpm dev --port 5201 --strictPort`.

Com os mocks ligados, a rota `/` abre o Início com o catálogo do mock (30 NFTs, 12 por página). O painel de debug do spike do R1 foi removido na MYK-1075.

**Os mocks precisam de `VITE_ENABLE_MOCKS=true`**, e esse valor já vem versionado. O `.env.development` (usado pelo `pnpm dev`) e o `.env.production` (usado pelo `pnpm build`, inclusive na Vercel) trazem as três variáveis abaixo; nenhuma é secreta. Sem mocks, o app abre sem API e o catálogo mostra o erro "Não foi possível carregar os NFTs.".

### Variáveis de ambiente

Versionadas em `.env.development` e `.env.production`, com os mesmos valores, e tipadas em `src/vite-env.d.ts`. O `.env.example` repete os valores como modelo. Para sobrescrever localmente, use um `.env.local` (ignorado pelo git) ou a variável no shell, que tem prioridade sobre os arquivos: `VITE_ENABLE_MOCKS=false pnpm dev` sobe sem MSW.

| Variável | Valor versionado | Descrição |
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
| `pnpm lighthouse` | `pnpm build` + Lighthouse 3x em Início e Detalhe, mobile e desktop, sobre o `vite preview` (porta 5210). Relatórios e medianas em `lighthouse/reports/`. |
| `pnpm test` | `vitest run` (ambiente node, sem jsdom: `EthAmount`/`big.js`, interceptor do Axios e sessão, ciclo de vida da sessão, camada de mocks, estado do catálogo na URL, faixa de preço, edição, cache de favoritos e validação de contas, avatar e carteiras). |

## Fluxo de branches e CI

PRs de feature têm como base `develop`. Depois de validada em `develop`, uma PR `develop` -> `main` leva a entrega para a `main`.

O workflow `.github/workflows/ci.yml` roda em toda PR para `develop`/`main` e em todo push nelas, com dois checks:

| Check | O que roda |
| -- | -- |
| `lint` | `pnpm lint` e `pnpm typecheck` |
| `test` | `pnpm test` |

O build não roda no CI: o check **Vercel** (abaixo) já executa o `pnpm build` (que inclui o `tsc -b`) e fica vermelho se ele falhar.

## Deploy (Vercel)

O repositório está ligado à Vercel pela integração com o GitHub (projeto `kurio-nft-marketplace`). Todo push gera um deploy e o check **Vercel** no commit. Cada PR recebe um comentário do bot com a URL do preview, e a produção sai da branch padrão do repo (`main`), salvo outra escolha em Settings -> Git na Vercel. Não há Action de deploy, de propósito: ela duplicaria os deploys da integração e exigiria um token da Vercel nos secrets.

> TODO: os domínios do projeto (`*-bruno88cabrals-projects.vercel.app`) estão atrás da Deployment Protection da Vercel e respondem 302 para o login. O domínio `kurio-nft-marketplace.vercel.app` **não** é deste projeto (serve outro código). Para ter uma URL pública, desligar a proteção ou adicionar um domínio em Settings -> Domains. O spike do R1 continua validado só em `pnpm build && pnpm preview` local (ver `ARCHITECTURE.md`).

Configuração esperada do projeto na Vercel:

1. Framework preset **Vite**, build command `pnpm build`, output directory `dist`. O `vercel.json` já tem o rewrite de SPA e o `pnpm-workspace.yaml` evita o erro de postinstall do `msw` no install.
2. Nenhuma variável precisa ser cadastrada no painel: o build lê o `.env.production` versionado. Uma variável cadastrada em Settings -> Environment Variables **sobrescreve** o arquivo, então o painel deve ficar sem `VITE_*` (ou com os mesmos valores).
3. Com o domínio público, conferir em aba anônima: o Início carregando o catálogo (30 NFTs, "Filtros" e paginação); refresh direto em `/nfts/nft-001` e `/cart` carregando a SPA; `/nfts/nao-existe` mostrando "NFT não encontrado"; `/mockServiceWorker.js` respondendo JavaScript. **A checagem do socket mudou:** o painel que mostrava `socket: connected` e o `nft.updated` saiu na MYK-1075. Desde o M4 o cache consome os eventos, então a prova é a tela: abra `/nfts/nft-001`, rode `__kurioMock.emit.nftUpdated('nft-001', { price: '7.77' })` no console e veja o preço do Detalhe mudar sem recarregar (receita 41). Depois de conferir isso no domínio público, o R1 deixa de ser só parcialmente mitigado. Em produção, verifique também que o console do navegador não mostra erro de WebSocket (`wss://realtime.kurio.mock`).

## Documentação

- [`ARCHITECTURE.md`](./ARCHITECTURE.md): estrutura, decisões do M0, a camada de mocks (contratos de cada endpoint, sessão, carrinho, socket), o M2 (catálogo na URL, Detalhe, cache e favoritos otimistas, base da sessão no cliente), o M3 (ciclo de vida da sessão, login e cadastro em modal, rotas protegidas, Perfil e Carteiras, isolamento do cache por conta), o M4 (carrinho do visitante e da conta, cotação, Pagamento com formulário do colecionador, carteira e rede, revisão, revalidação e pedido idempotente, Confirmação e recibo, reconciliação de eventos no cache), os desvios do Figma, as decisões de UX e acessibilidade e o esqueleto das seções que serão preenchidas.

## Credenciais fictícias

Com os mocks ligados (`VITE_ENABLE_MOCKS=true`) existem dois usuários, ambos com a mesma senha:

| Usuário | E-mail | Senha | Carteiras |
| -- | -- | -- | -- |
| Ana Souza | `ana@kurio.test` | `Kurio#2026` | `wallet-ana-1` (Ethereum, principal). Favoritos: `nft-002` e `nft-009`. |
| Bruno Lima | `bruno@kurio.test` | `Kurio#2026` | `wallet-bruno-1` (Ethereum, principal) e `wallet-bruno-2` (Polygon). |

Os dois começam com carrinho vazio e nenhum pedido. Cupons: `KURIO10` (válido, 10%), `EXPIRED5` (expirado); qualquer outro código é inválido. Os dados são fictícios e a senha é só de mock.

### Entrar e sair

1. Com o app aberto (mocks ligados), clique em **Entrar** no header (ou abra `/login`) e use `ana@kurio.test` / `Kurio#2026` (ou `bruno@kurio.test`). O modal abre sobre o Início; ao entrar você volta para onde estava (`?redirect=`), e o header mostra o nome ("Ana Souza"). No desktop as abas **Entrar | Criar conta** trocam entre `/login` e `/signup`; no celular a tela é inteira, sem header nem tab bar, com o link "Crie uma conta" / "Entre" no rodapé e um **Voltar** no canto (Esc também fecha). As duas formas mantêm o `redirect`.
2. Abrir uma rota protegida sem sessão (`/profile`, `/wallets`) leva a `/login?redirect=<rota>` e volta para ela depois de entrar. Fechar esse modal (X ou Esc) leva ao Início.
3. **Sair:** menu da conta no header (nome > "Sair"). No celular e no tablet (abaixo de 1024 px), o botão **Sair** fica no topo de Perfil e Carteiras. O toast é "Você saiu da conta.".
4. **Trocar de usuário (Ana → Bruno):** saia e entre com o outro e-mail, na **mesma aba**. O cache de favoritos, perfil e carteiras é zerado a cada troca; o Bruno vê as 2 carteiras dele e nenhuma da Ana.
5. Perfil (`/profile`) e Carteiras (`/wallets`): ver o roteiro em [Falhas de conta e sessão (M3)](#falhas-de-conta-e-sessão-m3).

**A sessão do mock vive no banco do mock:** trocar de cenário ou chamar `__kurioMock.reset()` reinicia o banco e **apaga as sessões**. Depois de trocar de cenário, entre de novo pela interface. O cenário também fica salvo: depois de abrir `?scenario=slow`, as próximas cargas sem a query continuam em `slow`; volte com `?scenario=default`.

#### Atalho pelo console (opcional)

Ainda funciona e é útil para scripts. Cole no console, com o app aberto na raiz e os mocks ligados:

```js
const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'ana@kurio.test', password: 'Kurio#2026' }) }).then((r) => r.json())
localStorage.setItem('kurio:session', JSON.stringify({ token: r.token, expiresAt: r.expiresAt }))
location.reload()
```

Depois do reload o app lê a sessão e reconecta o socket com o token (`resumeSession`). O formato guardado é `{ "token": string, "expiresAt": <ISO 8601> }` na chave `kurio:session`; sessão vencida, JSON ilegível ou fora desse formato conta como visitante. Para sair pelo console: `localStorage.removeItem('kurio:session'); location.reload()`. O `token=` da conexão do socket **não aparece** no log do MSW (ele remove a query da URL).

> O token fica em `localStorage` (legível por XSS). É um trade-off do mock; numa API real seria um cookie `httpOnly`. Trocar a senha **não** encerra as outras sessões. Detalhes no `ARCHITECTURE.md`, seção "Sessão".

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

**Limitação atual: uma aba por vez.** Cada aba tem o próprio estado sobre o mesmo `localStorage` e a última gravação vence; abrir duas abas do app pode apagar sessões e pedidos de uma delas, e o socket do mock também é por aba. Teste entre contas na mesma aba, saindo e entrando de novo. O app ouve mudanças em `kurio:session` e **recarrega** a aba quando outra entra, sai ou troca de conta, para não mostrar a conta errada, mas isso não torna o mock multi-aba.

Nome de cenário inválido lança `Error` e não altera nada. Para zerar tudo na mão: apague `kurio:mock-db:v1` e `kurio:mock-scenario` do `localStorage` e recarregue.

**Eventos de tempo real** (cada um gera `eventId` e `version`; desde o M4 o cache os consome: o Detalhe, as listas e o carrinho reagem, e a Confirmação do pedido muda sozinha; o console do MSW também mostra a entrega. Receitas em [Falhas do carrinho, pagamento e tempo real](#falhas-do-carrinho-pagamento-e-tempo-real-m4)):

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
5. **Sessão expirada (API).** Abra `/?scenario=session-expired`, cole o helper e rode `const token = await login(); await api('GET', '/auth/session', { token })` (200). Espere mais de 15s e repita a chamada: `{ status: 401, body: { code: 'unauthorized', ... } }`.
6. **Cadastro com e-mail já usado.** Duas formas: sem cenário, `await api('POST', '/auth/signup', { body: { name: 'Ana', email: 'ana@kurio.test', password: 'Kurio#2026' } })` já devolve 409; com `/?scenario=signup-conflict`, o mesmo 409 sai para **qualquer** e-mail novo.
7. **Cupom inválido ou expirado.** Sem cenário: `EXPIRED5` sai `expired` e `QUALQUER` sai `invalid`; `KURIO10` sai `applied` (10% de desconto). Com `/?scenario=coupon-invalid` ou `coupon-expired`, **qualquer** código (inclusive `KURIO10`) sai com aquele status. Receita: rode só a parte 1 de "Preparar uma compra", depois `await api('PUT', '/cart/coupon', { token, body: { code: 'KURIO10' } })` e `(await api('POST', '/quotes', { token })).body.coupon` mostra `{ code: 'KURIO10', status: 'invalid' }` com `discount: '0'`.
8. **Preço mudou entre cotação e pedido.** Abra `/?scenario=price-changed` (comece pelo `reset()`), faça o "Preparar uma compra" e rode `await order('k1')`: `{ status: 409, body: { code: 'conflict', fieldErrors: { 'nft-005:open': 'Preço alterado de 0.15 para 0.16 ETH.' } } }`. Cote de novo, reatribuindo a variável (`quote = (await api('POST', '/quotes', { token })).body`), e peça com outra chave (`await order('k2')`): sai 201 (o helper `order` usa o `quote` atual), porque o preço só muda no primeiro toque do NFT.
9. **Esgotou entre cotação e pedido.** Igual ao anterior com `/?scenario=sold-out`: `order('k1')` devolve 409 com `fieldErrors: { 'nft-005:open': 'Estoque insuficiente (restam 0).' }`. Uma nova cotação (`(await api('POST', '/quotes', { token })).body.issues`) já sai com `[{ nftId: 'nft-005', edition: 'open', kind: 'unavailable' }]`, e pedir com ela segue dando 409.
10. **Timeout do pedido e retry idempotente.** Abra `/?scenario=order-timeout`, faça o "Preparar uma compra" e rode `await api('POST', '/orders', { token, key: 'k1', timeoutMs: 10000, body: { quoteId: quote.quoteId, walletId: 'wallet-ana-1' } })`. Depois de 10s a chamada aborta (`TimeoutError`), mas o pedido já foi criado. Repita **a mesma chamada** com a mesma `key` (sem `timeoutMs`): volta rápido com **200** e o mesmo `id`, e `(await api('GET', '/orders', { token })).body` tem um único pedido. Chave nova com a mesma cotação dá 409 ("Esta cotação já foi usada em outro pedido.").
11. **Pagamento recusado.** Abra `/?scenario=payment-declined`, faça o "Preparar uma compra" e rode `const o = (await order('k1')).body` (201, `status: 'pending'`). Após ~2,5s `(await api('GET', '/orders/' + o.id, { token })).body.status` é `'declined'` (sem `txHash`, estoque intacto). No cenário `default` o mesmo fluxo termina `'confirmed'` com `txHash`.
12. **Favorito falhando.** Abra `/?scenario=favorite-fail`, rode `const token = await login(); await api('PUT', '/favorites/nft-001', { token })`: `{ status: 503, body: { code: 'transient', message: 'Não foi possível atualizar os favoritos.' } }`. O `DELETE` falha igual; `GET /favorites` continua funcionando.
13. **Carteira recusada.** Abra `/?scenario=wallet-rejected`, rode `const token = await login(); await api('POST', '/wallets/wallet-ana-1/connect', { token })`: `{ status: 409, body: { code: 'conflict', message: 'A carteira recusou a conexão. ...' } }`. Fora desse cenário a mesma chamada devolve 200 com a carteira.
14. **Evento duplicado.** Com a rota `/` aberta, rode `__kurioMock.emit.nftUpdated('nft-001', { price: '3' })` e depois `__kurioMock.duplicateLast()`: o mock publica o mesmo `eventId` e `version` duas vezes (visível no console do MSW). O app aplica o primeiro e descarta o duplicado (receita 41). Cada `emit` seguinte traz uma `version` maior.
15. **Pedido de outra conta e sem autenticação.** Sem `token`, `await api('GET', '/orders')` devolve 401; com o token do Bruno (`await login('bruno@kurio.test')`), `GET /orders/<id de pedido da Ana>` devolve 403.

### Falhas do Início e do Detalhe (M2)

Estas receitas são pela **interface** (não precisam do helper acima). Todas com mocks ligados. Cenário novo = banco do mock reiniciado, então as que precisam de login pedem [entrar de novo](#entrar-e-sair) pela interface.

16. **Catálogo vazio (`empty`).** Abra `/?scenario=empty`. O grid mostra "Nenhum NFT encontrado" com o botão "Limpar filtros", o status diz "0 NFTs encontrados", a sidebar mostra "Nenhuma coleção" e o slider de preço fica desabilitado.
17. **Skeleton (`slow`).** Abra `/?scenario=slow` (4s por chamada). O grid mostra skeletons com shimmer (o brilho atravessa as caixas; com movimento reduzido ficam estáticos) e a mesma caixa dos cards. Com o catálogo carregado, trocar de aba ("Em alta") ou de filtro deixa os cards atuais esmaecidos (`aria-busy`) até a resposta chegar. No Detalhe, `/nfts/nft-001?scenario=slow` mostra o skeleton "Carregando NFT…" depois de 1s; no cenário `default` o skeleton não aparece.
18. **Resposta fora de ordem (`jitter`).** Abra `/?scenario=jitter` (300ms a 7s por chamada) e troque de aba várias vezes seguidas (Novos lançamentos, Em alta, Todos). A tela termina na aba clicada por último, com o grid daquela aba, mesmo que uma resposta antiga chegue depois.
19. **Erro com retry (`offline` / `server-error`).** Abra `/?scenario=offline` ou `/?scenario=server-error`. Header, hero e filtros continuam na tela; o grid mostra "Não foi possível carregar os NFTs." com "Tentar novamente" (a sidebar e o hero têm o próprio erro). No Detalhe, `/nfts/nft-001?scenario=offline` mostra "Não foi possível carregar o NFT." com "Tentar novamente". O retry refaz a requisição, mas o cenário continua falhando; para ver a recuperação, abra `/?scenario=default` (o cenário só muda recarregando).
20. **NFT inexistente.** Abra `/nfts/nao-existe` (com `?scenario=default` se um cenário anterior ficou salvo): "NFT não encontrado" com o link "Voltar ao Início", título da aba "NFT não encontrado · Kurio" e uma única requisição.
21. **URL de catálogo inválida.** Abra `/?page=abc&tab=hot&priceMin=x&network=solana`: o Início ignora os valores inválidos e mostra os 12 primeiros NFTs. `/?page=9` mostra "Página não existe" com link para a última página. Em `/nfts/nft-017?edition=xyz` o valor é ignorado; `?edition=1/10` (esgotada nesse NFT) mostra o aviso "Edição indisponível. Mostrando a edição 1/50.".
22. **Favorito com rollback (`favorite-fail`).** Abra `/nfts/nft-002?scenario=favorite-fail`, entre como Ana pelo modal (o cenário apagou a sessão) e clique em "Favoritar Solar Veil" (a nft-002 já vem favoritada no seed da Ana, então `aria-pressed` passa de `true` para `false` na hora). A requisição falha com 503: o botão volta para `true` e aparece o toast "Não foi possível atualizar os favoritos.". Como visitante, o mesmo clique leva a `/login?redirect=%2Fnfts%2Fnft-002`. No Início em 390 px de largura, o coração fica no canto do card (no desktop o card não tem coração).
23. **`?redirect=` externo.** Abra `/login?redirect=https://evil.example`: o valor é descartado (a URL fica `/login`). Só caminho interno (começando com `/`) é aceito.

### Falhas de conta e sessão (M3)

Pela **interface**, com mocks ligados. Lembre que trocar de cenário apaga as sessões: entre de novo depois.

24. **Sessão expirada na tela (`session-expired`).** Abra `/?scenario=session-expired`, entre como Ana (o token vale 15s) e **navegue** até `/nfts/nft-001` pelo app (clicando em um NFT; recarregar levaria o `?scenario=` para dentro do `redirect`). Em ~15s aparece **um** toast "Sua sessão expirou. Entre novamente.", a URL vira `/login?redirect=%2Fnfts%2Fnft-001` e o header volta a "Entrar", sem recarregar. Entrando de novo, você volta a `/nfts/nft-001`. Um 401 antes do timer (token que o mock não conhece) dá o mesmo fluxo.
25. **Cadastro com e-mail já usado (`signup-conflict`).** Abra `/signup`. Sem cenário, use `ana@kurio.test`; com `/signup?scenario=signup-conflict`, qualquer e-mail novo. O erro "Já existe uma conta com este e-mail." aparece no campo e-mail, com o link "Entrar com este e-mail" (mantém o `redirect`). Envio vazio mostra 4 erros e não faz request.
26. **Senha errada.** Em `/login`, `ana@kurio.test` com outra senha: "E-mail ou senha inválidos.", o modal continua aberto e **nenhuma sessão é apagada** (o 401 das rotas de entrada não derruba a sessão).
27. **Senha atual incorreta.** Logada, em `/profile`, preencha "Alterar senha" com uma senha atual errada e clique em "Salvar": "Senha atual incorreta." no campo (422). Confirmação diferente da nova dá erro antes do envio. Trocando com sucesso ("Senha alterada."), saia: a senha antiga falha e a nova entra. **Restaure** a senha da Ana para `Kurio#2026` (ou use `__kurioMock.reset()`).
28. **Avatar grande ou formato errado.** Em `/profile` > "Alterar" (avatar), um `.svg` mostra "Envie uma imagem PNG, JPEG, WebP ou GIF." e um arquivo acima de 140 KB mostra "A imagem deve ter até 140 KB.", os dois **sem request**. Um PNG pequeno persiste no refresh; "Remover" também.
29. **Nome de exibição inválido.** Vazio ou com mais de 60 caracteres dá erro no campo, sem request. Mudar o nome **não** muda o nome do header, que vem da conta (`Account.name`).
30. **Carteira duplicada.** Em `/wallets`, adicione o mesmo endereço e rede de uma carteira existente (a comparação ignora maiúsculas): "Esta carteira já está conectada." (409) no campo endereço.
31. **Endereço inválido e apelido longo.** `0x123` mostra "Endereço inválido…" e "Selecione a rede." sem request; um apelido de 41 caracteres mostra "Use até 40 caracteres.". Um endereço `0x` + 40 hex em Polygon cria a carteira como Reserva.
32. **Remover a principal.** No menu do card, "Remover" pede confirmação (foco em "Cancelar"); confirmando a principal, outra carteira assume. Remover todas mostra o estado vazio e sobrevive ao refresh. "Definir como principal" rebaixa a anterior.
33. **Troca de usuário Ana → Bruno.** Entre como Ana, abra `/wallets` (1 carteira), saia, entre como Bruno: aparecem só as 2 do Bruno, sem flash dos cards da Ana, e `nft-001` não vem favoritado.
34. **Troca de cenário apaga a sessão; `offline` e `server-error` na rota protegida.**
    * **Cenário que não falha a rota** (ex.: `/profile?scenario=empty`), estando logado: a troca reinicia o banco do mock, o token guardado passa a dar 401 e você cai em `/login?redirect=%2Fprofile%3Fscenario%3Dempty`, com **um** toast "Sua sessão expirou. Entre novamente.".
    * **`/profile?scenario=offline` ou `server-error`**, estando logado: esses cenários falham **toda** rota antes do handler (erro de rede ou 503 `transient`), então `GET /auth/session` nunca devolve 401. A sessão guardada **não** é apagada e a guarda mostra o erro "Não foi possível confirmar sua sessão." ("Verifique sua conexão e tente de novo.") com "Tentar novamente". O retry continua falhando enquanto o cenário valer; abrir `?scenario=default` troca o cenário, reinicia o banco e cai no caso anterior (login com `redirect`).
    * Os erros "Não foi possível carregar seu perfil." / "suas carteiras." só aparecem se o `GET` falhar com a sessão viva (por exemplo, interceptando a request nas ferramentas do navegador); o formulário de senha e o de carteira continuam disponíveis.

### Falhas do carrinho, pagamento e tempo real (M4)

Pela **interface**, com mocks ligados, mais o console para os eventos. Trocar de cenário reinicia o banco do mock: apaga as sessões **e esvazia o carrinho**, então cada receita começa de novo (entrar e adicionar o NFT). Valores de referência: o Solar Veil (`nft-002`, edição `1/10`) custa 0.35 ETH e a taxa de rede é 0.002 ETH.

**Preparar a compra** (usado nas receitas 37 a 40, 43, 44 e 51 a 54):

1. Abra `/?scenario=<nome>` (ou `/?scenario=default`).
2. [Entre](#entrar-e-sair) como Ana (`ana@kurio.test` / `Kurio#2026`).
3. Abra `/nfts/nft-002?edition=1%2F10` e clique em "COMPRAR" (desktop): o item entra e a tela vai para `/cart` (o selo do header passa a "Carrinho, 1 item"). No celular, o carrinho redondo da barra ("Adicionar ao carrinho") adiciona e mostra o toast "Adicionado ao carrinho"; "Comprar NFT" adiciona e vai para `/cart`.
4. Em `/cart`, clique em "Conectar e finalizar" (`/checkout`).
5. No "Perfil do colecionador", preencha os campos que o mock não conhece (a validação é só no cliente e eles **não** vão no pedido). Valores que passam:

   | Campo | Valor de exemplo | Regra |
   | -- | -- | -- |
   | Nome de usuário | `ana_kurio` | 3 a 20 letras minúsculas, números ou `_` |
   | Nome do perfil | `Ana Colecionadora` | obrigatório, até 60 caracteres |
   | Código de indicação | `KURIO-2026` | 4 a 16 letras, números ou hífen |
   | Nome ENS | `ana` (o `.eth` já está ao lado) | 3 a 63 letras, números ou hífen, sem hífen nas pontas |
   | ENS ou carteira secundária (opcional) | `nova.kurio.eth` ou um `0x` com 40 hexadecimais | vazio vale |
   | Observação (opcional) | qualquer texto | até 500 caracteres |

   Nome de exibição e E-mail já vêm preenchidos com os da conta e são editáveis, mas editá-los **não** muda o Perfil. Os valores ficam no rascunho (`sessionStorage`): sobrevivem a refresh e à expiração da sessão e caem ao sair da conta pelo menu e depois do pedido confirmado.
6. Em "Carteira e rede", escolha o provedor (MetaMask, por exemplo) e clique em "Conectar com MetaMask" (receitas 35, 37, 38 a 40, 43 e 50). A carteira em si (Rede, Endereço e Tipo de carteira) vem do formulário: a principal por padrão.

Nestas receitas, **"confirme"** é: "Confirmar compra" na página (que valida o formulário) e "Confirmar compra" no diálogo "Revise seu pedido". "Tentar de novo" reenvia direto, sem diálogo.

35. **Fluxo feliz, do visitante ao recibo.** Em `/?scenario=default`, **sem entrar**, abra `/nfts/nft-002?edition=1%2F10` e adicione ao carrinho (o selo do header mostra "Carrinho, 1 item" e `localStorage['kurio:cart']` guarda a linha). Em `/cart` aparece "Entre para ver o total e aplicar cupons." (sem total nem campo de cupom). Clique em "Entrar para finalizar", entre como Ana e a página volta a `/cart` com o item (o `POST /cart/merge` esvazia o `kurio:cart`). A linha mostra o preço 0.35 ETH, a quantidade com "−" e "+" e o total da linha 0.35 ETH (em laranja); o "Resumo da carteira" mostra Subtotal 0.35, "Desconto (-) 0 ETH", Taxa de rede 0.002 ("Taxa estimada") e Total 0.352 ETH. Em "Código promocional", digite `kurio10` e "Aplicar": linha "Desconto (KURIO10) (-) 0.035 ETH" e Total 0.317 ETH. "Conectar e finalizar", escolha MetaMask em "Carteira e rede" e "Conectar com MetaMask" (o "Confirmar compra" deixa de estar bloqueado), preencha o "Perfil do colecionador" (passo 5 de "Preparar a compra"), "Confirmar compra" e, no diálogo "Revise seu pedido", "Confirmar compra": a Confirmação abre no painel "Thank you" e passa de "Aguardando confirmação da rede" a "Seus NFTs agora estão na sua carteira" em ~2,5s, com a faixa "ID da transação" (abreviado) / "Data" / "Total 0.317 ETH" / "Carteira principal", os "Detalhes da transação" (Solar Veil, "Edição: 1/10", "(x 1)" e 0.35 ETH), "Desconto (-) 0.035 ETH", Taxa de rede, Total 0.317 ETH, "Transação confirmada na Ethereum." e "Ver no Etherscan" (nova aba), e a linha discreta "Pedido … · Chave …"; o X ("Fechar e voltar ao Início") leva a `/`, e o selo do carrinho volta a "Carrinho" (o comprado saiu).
36. **Cupom inválido ou expirado.** Sem cenário, entre como Ana, adicione o NFT e, em `/cart`, aplique `EXPIRED5`: "Cupom expirado." e Total 0.352 (sem desconto); `QUALQUER`: "Cupom inválido."; `KURIO10`: "Cupom KURIO10 aplicado" com o botão "Remover cupom". Com `/?scenario=coupon-invalid` ou `/?scenario=coupon-expired` (entre e adicione de novo), **qualquer** código, inclusive `KURIO10`, sai "Cupom inválido." ou "Cupom expirado." sem desconto. Nesses dois estados aparece "Remover" ao lado da mensagem: ele tira o código do carrinho (`GET /cart` volta sem `couponCode`) e o campo volta a "Aplicar". "Conectar e finalizar" continua um link ativo.
37. **Carteira recusada (`wallet-rejected`).** Prepare a compra com `/?scenario=wallet-rejected`, escolha MetaMask e clique em "Conectar com MetaMask": o MetaMask fica com o status de recusa e mostra, na própria linha do provedor (um `role="alert"` `sr-only` anuncia o mesmo texto), "A carteira recusou a conexão. Aprove o pedido no app da carteira e tente de novo.". "Confirmar compra" fica bloqueado, apontando para "Conecte uma carteira para confirmar." (clicar nele valida o formulário, mas não abre a revisão nem envia nenhum `POST /orders`), e "Tentar novamente" repete o `POST /wallets/wallet-ana-1/connect` (sempre 409 neste cenário).
38. **Os valores mudaram entre revisar e confirmar.** Prepare a compra em `default`, conecte a carteira (provedor + "Conectar com …") e clique em "Confirmar compra" na página: o diálogo "Revise seu pedido" abre com Total 0.352 ETH. **Com o diálogo aberto**, rode no console `__kurioMock.emit.nftUpdated('nft-002', { price: '1.5' })` e clique em "Confirmar compra" no diálogo: **nenhum** `POST /orders` sai, o diálogo fecha, o resumo fica "Cotação desatualizada." com "Os valores mudaram. Revise e confirme de novo." e "Total: de 0.352 ETH para 1.502 ETH.", e a linha mostra "Preço alterado de 0.35 ETH para 1.5 ETH.". Um novo "Confirmar compra" na página reabre o diálogo já com 1.502 ETH, e confirmar nele envia o pedido (um único `POST /orders`). **Antes** de abrir o diálogo: recomece (ou feche o diálogo), rode o mesmo `__kurioMock.emit.nftUpdated('nft-002', { price: '1.5' })` e espere o resumo sair de "Recalculando os valores.". O "Confirmar compra" da página abre o diálogo com "Os valores mudaram desde a revisão anterior.", "Total: de 0.352 ETH para 1.502 ETH." e, na linha, "Preço alterado de 0.35 ETH para 1.5 ETH.": o diálogo é a nova confirmação, e confirmar nele envia um único `POST /orders`. Um cupom aplicado no Pagamento aparece do mesmo jeito ("Cupom aplicado." e o total com desconto), sem bloquear o envio.
39. **Preço mudou no servidor (`price-changed`).** Prepare a compra com `/?scenario=price-changed`, conecte a carteira e confirme: o `POST /orders` responde 409 e a linha mostra "Preço alterado de 0.35 para 0.36 ETH."; o diálogo fecha e o resumo recota para Subtotal 0.36 e Total 0.362 ("Alguns itens mudaram desde a revisão. Confira os valores e confirme de novo."), sem pedido criado. Confirmar de novo (a página reabre o diálogo com 0.362) cria o pedido com **outra** `Idempotency-Key` (a primeira foi descartada pelo 409) e termina em "Seus NFTs agora estão na sua carteira". O preço só muda no primeiro toque do NFT: para repetir, `__kurioMock.reset()` e comece de novo.
40. **Esgotou (`sold-out`).** Prepare a compra com `/?scenario=sold-out`, conecte e confirme: aparece "Estoque insuficiente (restam 0)." na linha e "Há itens indisponíveis ou com preço alterado. Ajuste o carrinho para continuar." com o link "Voltar ao carrinho"; "Confirmar compra" fica bloqueado e não envia mais nada (só o `POST /orders` que deu 409 aparece na rede). Em `/cart` a linha mostra "Indisponível" e "Conectar e finalizar" fica bloqueado.
41. **`nft.updated` no Detalhe e na lista.** Em `default`, abra `/nfts/nft-001` (2.5 ETH) e rode `__kurioMock.emit.nftUpdated('nft-001', { price: '7.77' })`: o preço vira 7.77 ETH **sem recarregar e sem nenhuma requisição** na aba Rede. `__kurioMock.duplicateLast()` reenvia o mesmo `eventId` e `version`: a tela não muda (duplicata descartada). Um novo `emit.nftUpdated('nft-001', { price: '1.23' })` (version maior) volta a aplicar. Na lista (`/`), o card do `nft-001` também muda de preço com um novo `emit`.
42. **`nft.updated` e a cotação do carrinho.** Entre como Ana, adicione o `nft-002` (`1/10`) e abra `/cart`. `__kurioMock.emit.nftUpdated('nft-009', { price: '5' })` (NFT fora do carrinho) **não** gera nenhum `POST /quotes`. `__kurioMock.emit.nftUpdated('nft-002', { price: '3.33' })` mostra "Cotação desatualizada. Recalculando os valores com a mudança no carrinho." por um instante e, com um `POST /quotes`, o resumo passa a Subtotal 3.33 e Total 3.332 ETH. No `/checkout`, o mesmo evento mostra "Recalculando os valores.".
43. **Timeout do pedido e "Tentar de novo" (`order-timeout`).** Prepare a compra com `/?scenario=order-timeout`, conecte e confirme. Depois de ~10s aparece "Não confirmamos o envio." com o botão "Tentar de novo" no lugar de "Confirmar compra"; `sessionStorage['kurio:checkout:user-ana']` guarda a chave e o corpo (`idempotencyKey`, `attempt`). Recarregue a página: continua em `/checkout` com o mesmo aviso (o `collector` continua no rascunho; com o carrinho vazio, o mock já o esvaziou, a tela é a de "Pedido enviado" e o formulário não aparece). "Tentar de novo" reenvia o **mesmo** corpo com a **mesma** `Idempotency-Key` (confira os dois `POST /orders` na aba Rede), a Confirmação abre e, com o helper do Passo 0, `(await api('GET', '/orders', { token: await login() })).body` tem **um** único pedido. **Carrinho vazio com a tentativa pendente (MYK-1105):** no `order-timeout` o mock cria e confirma o pedido e tira o comprado do carrinho, então depois do "Não confirmamos o envio." (ou do refresh) o `/checkout` mostra, acima de "Tentar de novo", a lista da tentativa sob o título "Pedido enviado", sem número de etapa (MYK-1111) (Solar Veil, 1/10, 0.35 ETH), o resumo (Total 0.352 ETH) e o aviso "Estes são os itens e valores do pedido enviado. Mudanças no carrinho valem para a próxima compra.". **Carrinho alterado com a tentativa pendente (MYK-1104):** vá a `/cart`, adicione outro NFT ao carrinho (o mock já tirou o comprado) e volte a `/checkout`: a Revisão e o resumo continuam mostrando os itens e o total **da tentativa** (o que "Tentar de novo" compra), não os do carrinho novo. Nos dois casos "Tentar de novo" abre o mesmo pedido e `GET /orders` continua com um único pedido.
44. **Pagamento recusado (`payment-declined`).** Prepare a compra com `/?scenario=payment-declined`, conecte e confirme: a Confirmação passa por "Aguardando confirmação da rede" e termina em "Pagamento recusado" ("A rede recusou o pagamento. Nada foi cobrado; você pode tentar de novo."). "Voltar ao pagamento" abre `/checkout` com a carteira ainda conectada; confirmar de novo envia outra `Idempotency-Key`.
45. **`order.updated` sem polling.** Em `default`, prepare a compra, conecte e confirme. Com o socket conectado a aba Rede mostra **um** `GET /api/orders/<id>` (o refetch do `order.updated` que trouxe o `confirmed`; também há dois `GET /api/cart`, que são o carrinho sendo refeito) e nenhum a cada 3s. Com a Confirmação aberta, `__kurioMock.duplicateLast()` não gera requisição e `__kurioMock.emit.orderUpdated(location.pathname.split('/').pop())` gera um `GET /api/orders/<id>`. O polling de 3s só roda com o socket caído (`socket.connected === false`); no mock isso quase não dá para ver, porque o socket reconecta em ~1s.
46. **Queda da rede.** Em `default`, entre como Ana, adicione um item e abra `/` com a aba Rede aberta. Nas ferramentas do navegador, ponha a rede em "Offline" por ~2s e volte ao normal: o socket reconecta e a aba Rede mostra `GET /api/nfts/featured`, `/api/nfts/facets`, `/api/nfts?page=1&pageSize=12` e `GET /api/cart` (o catálogo e o carrinho ativos são refeitos; o que estava inativo só fica marcado).
47. **Sair da Confirmação com o pedido `pending` e comprar de novo.** Em `default`, prepare a compra, conecte e confirme; na Confirmação ("Aguardando confirmação da rede", ~2,5s) volte logo ao início pelo logo, **sem recarregar**. `sessionStorage['kurio:checkout:user-ana']` guarda a tentativa com o `orderId`; quando o `order.updated` traz o `confirmed`, o rascunho some mesmo com a Confirmação fechada. Adicione outro NFT e vá a `/checkout`: "Confirmar compra" aparece normal, sem "Não confirmamos o envio.", e o "Perfil do colecionador" volta vazio (o `confirmed` limpou o rascunho, formulário incluído). Se voltar a `/checkout` **antes** do `confirmed`, aparece "Seu pedido anterior ainda está em andamento." com "Acompanhar o pedido" (sem "Tentar de novo" e sem novo `POST /orders`), e o CTA volta sozinho quando o pedido confirma. Em qualquer caso `GET /orders` tem um único pedido por compra. No mock o `pending` dura ~2,5s; para ver o aviso com calma, a verificação desta correção esticou a liquidação com um andaime só do browser (um `addInitScript` que troca o `setTimeout` de 2500 ms por 15 s).

48. **Visitante no limite do estoque.** Em `/?scenario=default`, **sem entrar**, abra `/nfts/nft-001?edition=1%2F1` (1 de 1 disponível) e clique em "COMPRAR": o item entra e a tela vai para `/cart`. Volte ao Detalhe e clique de novo: o painel mostra, com `role="alert"`, "Só resta 1 unidade desta edição, e ela já está no seu carrinho." (o mesmo lugar do 409 do logado), a tela não sai do Detalhe, e o `kurio:cart` continua com 1 unidade. Na barra mobile (abaixo de 768 px) o aviso é um toast de erro. **Só parte cabendo (MYK-1111):** abra `/nfts/nft-002?edition=1%2F10` (estoque 6), aumente a quantidade para 4 e clique em "COMPRAR" (vai para `/cart` com 4); volte, aumente de novo para 4 e clique outra vez: só 2 cabem, o painel mostra "Só restam 6 unidades desta edição: seu carrinho ficou com 6." no mesmo lugar, sem sair do Detalhe, e o `kurio:cart` fica com 6.
49. **Motivo do CTA bloqueado.** Em `/cart`, enquanto a cotação carrega ou recota, "Conectar e finalizar" fica bloqueado com o motivo escrito abaixo ("Calculando o total…", "Aguarde: os valores estão sendo recalculados." ou, com a cotação em erro, "Não foi possível calcular o total. Tente novamente para continuar."), ligado ao botão por `aria-describedby`; com itens indisponíveis ele aponta para o alerta do resumo. No `/checkout`, antes de conectar, "Confirmar compra" aponta para "Conecte uma carteira para confirmar.".
50. **Sair e entrar derruba a conexão da carteira (MYK-1103).** Em `/?scenario=default`, entre como Ana, adicione o `nft-002` (`1/10`) e abra `/checkout`. Escolha MetaMask e clique em "Conectar com MetaMask" ("Carteira principal conectada com MetaMask."; `sessionStorage['kurio:checkout:user-ana']` guarda `connectedWalletId`). Saia pelo menu da conta e entre de novo como Ana: o rascunho fica só com `walletId` e `provider` (a conexão caiu no reset da sessão e o `collector` foi limpo no "Sair": o "Perfil do colecionador" volta vazio, só com o nome e o e-mail da conta), o `/checkout` mostra o botão "Conectar com MetaMask" e nenhum "conectada com", e "Confirmar compra" fica bloqueado (`aria-disabled`) até conectar de novo (um segundo `POST /wallets/wallet-ana-1/connect`). Com `/?scenario=order-timeout`, conecte e confirme até "Não confirmamos o envio.", saia e entre de novo e abra `/checkout`: o rascunho mantém `idempotencyKey`, `attempt` e `attemptSnapshot` (só a conexão cai), nem "Conectar com …" nem "Desconectar" aparecem, "Tentar de novo" continua no lugar de "Confirmar compra" e reenvia o mesmo corpo com a mesma `Idempotency-Key`.

51. **Desconectar a carteira.** Prepare a compra em `default`, escolha MetaMask e clique em "Conectar com MetaMask" ("Carteira principal conectada com MetaMask." e o botão "Desconectar"). Clique em "Desconectar": o foco vai para "Conectar com MetaMask", que volta no lugar, o status do MetaMask passa a desconectado, "Confirmar compra" fica bloqueado apontando para "Conecte uma carteira para confirmar." e o rascunho (`sessionStorage['kurio:checkout:user-ana']`) perde o `connectedWalletId`, mas mantém `walletId` e `provider`. "Desconectar" é só do cliente: não há endpoint (o `DELETE /wallets/:id` **remove** a carteira) e a aba Rede não mostra requisição nenhuma. Conectar de novo faz um segundo `POST /wallets/wallet-ana-1/connect`. Trocar de provedor (Coinbase Wallet, por exemplo) com a carteira conectada também desconecta. Com `/?scenario=order-timeout` e uma tentativa pendente, os provedores ficam desabilitados e não há "Conectar" nem "Desconectar" (R4).
52. **Formulário do colecionador: erros, foco e valores que passam.** Prepare a compra em `default` (passos 1 a 4) e conecte a carteira, **sem preencher** o formulário. Clique em "Confirmar compra": o foco vai para "Nome de usuário"; Nome de usuário, Nome do perfil, Código de indicação e Nome ENS ganham `aria-invalid` e a mensagem ligada por `aria-describedby` ("Informe um nome de usuário.", "Informe o nome do perfil.", "Informe o código de indicação.", "Informe o nome ENS."); acima do botão aparece "Revise os campos destacados." (`role="alert"`, ligado ao botão), o diálogo não abre e a aba Rede não mostra `POST /orders`. Sem conectar a carteira, o mesmo clique valida o formulário igual, e os dois motivos aparecem ("Revise os campos destacados." e "Conecte uma carteira para confirmar."). O erro some ao editar o campo e, depois de editado, também aparece ao sair dele (blur). Valores que **não** passam: `Ana Kurio` (usuário com maiúscula e espaço), `ab` (código curto), `a` ou `ana.eth` (ENS curto ou com `.eth`), `xyz` em "ENS ou carteira secundária" (precisa de um nome `.eth` ou de um `0x` com 40 hexadecimais). Valores que passam: `ana_kurio`, `KURIO-2026` e ENS `ana`. Nome de exibição vazio e e-mail sem `@` também bloqueiam. Recarregue a página no meio do preenchimento: os valores continuam.
53. **"Usar outra carteira?" e a rede.** Como Ana (só a carteira principal), marque "Usar outra carteira?": aparece "Você só tem a carteira principal." com o link "Cadastrar outra carteira" (`/wallets`), e Rede e Tipo de carteira continuam desabilitados. Como Bruno (`bruno@kurio.test`), marque a opção: Rede e Tipo de carteira habilitam só com as outras carteiras; escolher Polygon seleciona a Reserva (o Tipo mostra "Reserva · Polygon", papel · apelido), o Endereço muda para `0x4d6f…0d2f` completo e a conexão cai (a carteira mudou). Desmarcar volta à principal. O Endereço é só leitura (não dá para digitar uma carteira que não esteja cadastrada).
54. **Revisão antes do envio.** Com o formulário preenchido e a carteira conectada, "Confirmar compra" abre o diálogo "Revise seu pedido" (sem nenhuma chamada à API): dados do colecionador (Nome de exibição, Nome de usuário, Nome do perfil, E-mail, Código de indicação e Nome ENS como `ana.eth`), carteira (papel · apelido, rede, endereço abreviado), provedor, os itens com "(x N)" e o resumo com o total. O foco fica preso no diálogo (Tab nunca sai dele). "Voltar e editar" ou Esc fecha e devolve o foco a "Confirmar compra", sem `POST /orders`. "Confirmar compra" do diálogo envia **um** `POST /orders` com `{ quoteId, walletId }` (os campos do formulário não vão no pedido) e leva à Confirmação; dois cliques seguidos continuam gerando um único pedido.

**Não reproduzível por cenário:** a falha do `POST /cart/merge` ("Não foi possível juntar o carrinho de visitante."). O cenário `server-error` derruba também o login, então não dá para entrar com um carrinho de visitante e ver só o merge falhar. Isso só se reproduz com andaime (reescrever a URL do XHR de `/api/cart/merge` antes do login, como fez a verificação da MYK-1088) e está coberto por teste (`src/features/cart/mergeOnLogin.test.ts`). Por isso não é uma receita; o comportamento esperado (o login conclui, o `kurio:cart` fica intacto e o toast aparece) está em `ARCHITECTURE.md`, seção "Sessão".

## Testes E2E (Playwright)

> TODO (M5/M6): ainda não há Playwright configurado.

## Lighthouse

`pnpm lighthouse` faz o build otimizado, sobe o `vite preview` na porta 5210 e roda o Lighthouse 3 vezes em Início (`/`) e Detalhe (`/nfts/nft-001`), mobile e desktop, com o Chrome do sistema (headless, perfil limpo a cada execução) e os mocks no cenário `default`. A configuração versionada está em `lighthouse/config.mjs`; os 12 relatórios HTML/JSON, `summary.json` e `summary.md` (medianas, LCP/CLS/TBT, versões, ambiente e justificativas) ficam em `lighthouse/reports/`.

Medianas da medição versionada (detalhes em [`lighthouse/reports/summary.md`](lighthouse/reports/summary.md)):

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| Início | mobile | 69 | 100 | 100 | 100 | 4355 ms | 0.000 | 639 ms |
| Início | desktop | 96 | 100 | 100 | 100 | 1348 ms | 0.000 | 14 ms |
| Detalhe | mobile | 76 | 100 | 100 | 100 | 3837 ms | 0.000 | 500 ms |
| Detalhe | desktop | 96 | 100 | 100 | 100 | 1389 ms | 0.000 | 36 ms |

Performance no mobile fica abaixo de 90: o build publicado é a demo com MSW, cujo chunk (~174 kB gzip) é avaliado e cujo Service Worker é registrado antes do primeiro render (necessário para interceptar o socket), o que domina o TBT; e a imagem do LCP só existe depois que o mock responde. Nada disso foi desligado para a auditoria (§10). Justificativa completa no `summary.md`.
