# Aumento de coverage: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** medir o coverage no CI e levar o projeto a **≥ 80%** em linhas, statements, funções e branches,
cobrindo `components/` (inclusive smoke tests do shadcn) e todo arquivo que hoje está com 0%.

**Architecture:** o Vitest ganha um bloco `test` no `vite.config.ts` (include só de `src`, coverage v8 com
thresholds que sobem a cada task). Testes de componente rodam em jsdom com Testing Library e helpers
compartilhados em `src/test/`. Os handlers do MSW são testados em jsdom com `setupServer` + o `apiClient`
real, contra um runtime de mock de teste (latência 0, storage em memória).

**Tech Stack:** Vitest 5.0.5, `@vitest/coverage-v8` 5.0.5, `@testing-library/react` 16, jsdom 30, MSW 2
(`msw/node`), TanStack Query 5, TanStack Router 1, Radix (via shadcn).

**Spec:** `docs/superpowers/specs/2026-11-01-aumento-coverage-design.md`

## Backlog (substitui as tasks do Linear)

O Linear está sem cota para criar issues; este quadro é a fonte de verdade das tasks. Ao começar uma task,
mude o status para `em andamento`; ao abrir o PR, coloque o número. Quando o Linear voltar, cada linha vira
uma subtask `MYK-` da task-mãe "Aumentar coverage de testes para ≥ 80%" e o ID entra na coluna.

| ID | Task | Depende de | Esforço | Threshold ao fim (linhas/stmts/funcs/branches) | Status | PR / Linear |
|---|---|---|---|---|---|---|
| COV-0 | Infra do coverage e CI | — | 0,5 d | baseline medido − 1 | a fazer | |
| COV-1 | Helpers de teste (`src/test/`) | COV-0 | 0,5 d | igual | a fazer | |
| COV-2 | Harness MSW + handlers de conta | COV-1 | 1 d | medido − 1 | a fazer | |
| COV-3 | Handlers de catálogo, carrinho, pedidos e cenários | COV-2 | 1 d | medido − 1 | a fazer | |
| COV-4 | Smoke tests de `components/ui` | COV-1 | 0,5 d | medido − 1 | a fazer | |
| COV-5 | `components/kurio` | COV-1 | 0,75 d | medido − 1 | a fazer | |
| COV-6 | `components/layout` | COV-1 | 0,75 d | medido − 1 | a fazer | |
| COV-7 | Conta: entrar, cadastrar e sair | COV-1 | 1,5 d | medido − 1 | a fazer | |
| COV-8 | Conta: perfil, senha, avatar e carteiras | COV-7 | 1,5 d | medido − 1 | a fazer | |
| COV-9 | Catálogo (Início) | COV-1, COV-4 | 1,25 d | medido − 1 | a fazer | |
| COV-10 | Detalhe, favoritos, pedidos, lacunas de carrinho e checkout | COV-1 | 1,25 d | medido − 1 | a fazer | |
| COV-11 | Rotas e fechamento em 80% | todas | 1 d | **80 / 80 / 80 / 80** | a fazer | |
| | **Total** | | **~11,5 d** | | | |

## Rodada 1 (2026-11-01): fluxos essenciais com 100%

Decisão do Bruno: antes do backlog inteiro, cobrir **quatro fluxos essenciais** com **100% de coverage** nos
arquivos de cada fluxo. Execução sequencial na branch `bruno88cabral/cov-rodada-1`, nesta ordem:
**COV-0 → COV-1 → COV-7 → COV-9 → COV-8 → COV-10a**. As demais tasks (COV-2 a COV-6, resto do COV-10, COV-11)
ficam para a Rodada 2.

| Fluxo | Task | Arquivos do fluxo (alvo 100% em linhas, statements, funções e branches) |
|---|---|---|
| Entrar, cadastrar, sair e guarda de rota | COV-7 | `src/features/account/{LoginForm,SignupForm,AuthDialog,PasswordInput}.tsx`, `src/features/account/{useAuthForm,useSignOut,authGuards,authRedirect,validation}.ts`, `src/components/layout/{AccountMenu,SessionLink}.tsx`, `src/routes/{login,signup,_authenticated}.tsx` |
| Catálogo (Início) | COV-9 | `src/features/catalog/*`, `src/components/layout/HeaderSearch.tsx`, `src/components/kurio/{NftCard,StateMessage,PriceTag}.tsx`, `src/routes/index.tsx` |
| Conta: perfil, senha, avatar e carteiras | COV-8 | `src/features/account/{ProfileForm,PasswordForm,AvatarField,WalletList,WalletForm,WalletDialogs,AccountLayout,AccountPanel}.tsx`, `src/features/account/{useAccountForm,avatar}.ts`, `src/components/kurio/{WalletCard,AccountSidebar,FormField}.tsx`, `src/routes/_authenticated/{profile,wallets}.tsx` |
| Detalhe do NFT e favoritos | COV-10a | `src/features/nft-detail/*`, `src/features/favorites/*`, `src/features/cart/AddToCartButton.tsx`, `src/components/kurio/{FavoriteButton,EditionChips,QuantityStepper}.tsx`, `src/routes/nfts.$nftId.tsx` |

Regras da Rodada 1 (valem sobre o texto das tasks):

- **COV-10a** = a parte de detalhe e favoritos do COV-10 (primeiros seis itens do Step 1 dele) mais os arquivos da
  tabela. Pedidos, carrinho e checkout do COV-10 ficam para a Rodada 2.
- **Sem MSW nesta rodada:** COV-9 e COV-10a mockam `@/api/client` (padrão do `CheckoutPage.test.tsx`) em vez de
  usar `useMockServer` do COV-2, que não existe ainda.
- **100% travado no CI:** cada task adiciona ao `test.coverage.thresholds` do `vite.config.ts` uma entrada por glob
  do seu fluxo com `{ lines: 100, statements: 100, functions: 100, branches: 100 }` (o Vitest aceita thresholds por
  glob). O global segue o ratchet (medido − 1).
- **Linha inalcançável:** se um ramo for impossível de exercitar sem mudar produção (ex.: guarda defensiva), não
  usar `/* v8 ignore */` sem registrar: o relatório da task lista o arquivo, a linha e o motivo, e o threshold daquele
  glob fica no valor medido. Não alterar código de produção para ganhar coverage.
- **Rotas no fluxo:** `beforeLoad`, `validateSearch`, `loader`, `head` e o `component` de cada rota da tabela são
  testados (o `component` renderizado com `routerMock` e a feature mockada quando preciso).

Paralelismo (Rodada 2): depois de COV-1, as trilhas {COV-2 → COV-3}, {COV-4, COV-5, COV-6}, {COV-7 → COV-8},
{COV-9, COV-10} são independentes. Os conflitos ficam só nos thresholds do `vite.config.ts`: quem fizer merge
depois rebaseia e mede de novo.

## Global Constraints

- Meta final: `thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 }`.
- `components/ui` **entra** no coverage e ganha smoke tests (decisão de 2026-11-01).
- Exclusões do coverage: `src/**/*.test.{ts,tsx}`, `src/test/**`, `src/routeTree.gen.ts`, `src/vite-env.d.ts`,
  `src/main.tsx`, `src/app/start.tsx`, `src/mocks/browser.ts`, `src/mocks/socket.ts`, `src/mocks/lifecycle.ts`,
  `src/routes/dev.*.tsx`. Exclusão nova só com justificativa no PR.
- Ratchet: ao fim de cada task, cada threshold = valor medido arredondado para baixo, menos 1 ponto
  (mediu 72,4% → 71). Nunca baixar um threshold.
- Ambiente por arquivo: arquivo que usa DOM começa com `// @vitest-environment jsdom`. O default continua node.
- Consultas por papel/rótulo acessível (`getByRole`, `getByLabelText`); `data-testid` só quando não houver
  papel. Textos esperados vêm do componente (copy em pt-BR), não inventados.
- Não alterar código de produção, exceto onde a task disser. Se um arquivo for intestável sem mudança,
  parar e registrar no PR.
- Testes ficam ao lado do arquivo testado (`Foo.tsx` → `Foo.test.tsx`), como no resto do repo.
- Contas de teste: `ana@kurio.test` / `bruno@kurio.test`, senha `Kurio#2026` (`FIXTURE_PASSWORD`).
- Commits em pt-BR no formato do repo (`test: ... (COV-n)`), um PR por task para `develop`.

## Review Focus

1. **Estado vazando entre testes** (localStorage `kurio:session`, `kurio:cart`, `kurio:mock-db:v1`, cache do
   `QueryClient`, o store singleton do mock): um teste que passa sozinho e quebra na suíte. Coberto em COV-1
   (`renderWithProviders` cria `QueryClient` novo e o `afterEach` limpa `localStorage`/`sessionStorage`) e em
   COV-2 (`resetMockDb` no `beforeEach`), com teste que grava, roda outro teste e confere vazio.
2. **Testes de `.claude/worktrees` entrando no `pnpm test` local.** Coberto em COV-0: passo de verificação
   com `vitest list` contando só arquivos de `src/`.
3. **Mutation da conta anterior aplicando efeito na sessão nova** (guarda `captureSession`). Coberto em COV-8:
   para `ProfileForm` e `WalletList`, teste que troca a sessão com a request em voo e confere que não há toast
   nem invalidação.
4. **Conteúdo de portal do Radix (Dialog, Sheet, Select, DropdownMenu, Tooltip) em jsdom:** abrir, fechar
   com `Escape` e devolver o foco ao gatilho. Coberto em COV-4 (`Dialog` e `DropdownMenu`) e COV-7 (`AuthDialog`).
5. **Falhas de rede e 5xx chegando à UI como mensagem, não como tela branca** (`offline`, `server-error`).
   Coberto em COV-3 (handlers devolvem `HttpResponse.error()` / 503 `transient`) e em COV-9 (grid do catálogo
   mostra o `ErrorState` com "Tentar novamente" e refaz a request).

---

### Task COV-0: Infra do coverage e CI

**Files:**
- Modify: `package.json` (script `test:coverage`, devDependency `@vitest/coverage-v8@5.0.5`)
- Modify: `pnpm-lock.yaml` (via `pnpm add`)
- Modify: `vite.config.ts` (bloco `test`)
- Modify: `.gitignore` (`coverage/`)
- Modify: `.github/workflows/ci.yml` (job `test`)
- Modify: `eslint.config.js` (override para `src/test/**`)

**Interfaces:**
- Produces: `pnpm test:coverage`; o bloco `test.coverage.thresholds` em `vite.config.ts`, que toda task
  seguinte atualiza.

- [ ] **Step 1: Instalar o provider**

Run: `pnpm add -D @vitest/coverage-v8@5.0.5`
Expected: `+ @vitest/coverage-v8 5.0.5`

- [ ] **Step 2: Configurar o Vitest em `vite.config.ts`**

Adicionar `/// <reference types="vitest/config" />` no topo e, no `defineConfig`, o bloco `test` com:
`include: ['src/**/*.test.{ts,tsx}']`, `exclude: ['**/node_modules/**', '.claude/**']`, e `coverage` com
`provider: 'v8'`, `include: ['src/**/*.{ts,tsx}']`, `exclude` = lista das Global Constraints,
`reporter: ['text-summary', 'json-summary', 'html']` e `thresholds` provisórios em `0`.

- [ ] **Step 3: Script, `.gitignore` e override do ESLint**

`"test:coverage": "vitest run --coverage"` em `scripts`; `coverage/` no `.gitignore`; no
`eslint.config.js`, bloco `files: ['src/test/**/*.{ts,tsx}']` com `'react-refresh/only-export-components': 'off'`.

- [ ] **Step 4: Conferir que só `src` roda**

Run: `pnpm vitest list --filesOnly | grep -vc '^src/'`
Expected: `0` (nenhum arquivo fora de `src/`, mesmo com `.claude/worktrees` presente)

- [ ] **Step 5: Medir o baseline**

Run: `pnpm test:coverage`
Expected: suíte verde e o `text-summary`. Esperado perto de linhas ~59% (com `components/ui` incluído).

- [ ] **Step 6: Fixar thresholds = medido − 1 e rodar de novo**

Run: `pnpm test:coverage`
Expected: PASS. Mudar um threshold para 99 deve falhar com `ERROR: Coverage for lines (...) does not meet global threshold (99%)`; voltar.

- [ ] **Step 7: CI**

No job `test` do `ci.yml`, trocar `pnpm test` por `pnpm test:coverage`.

- [ ] **Step 8: Lint, typecheck e commit**

Run: `pnpm lint && pnpm typecheck`
Expected: sem erros.

```bash
git add package.json pnpm-lock.yaml vite.config.ts .gitignore .github/workflows/ci.yml eslint.config.js
git commit -m "test: coverage v8 com threshold no CI e vitest só em src (COV-0)"
```

---

### Task COV-1: Helpers de teste (`src/test/`)

**Files:**
- Create: `src/test/render.tsx`
- Create: `src/test/routerMock.tsx`
- Create: `src/test/session.ts`
- Create: `src/test/dom.ts`
- Test: `src/test/helpers.test.tsx`

**Interfaces:**
- Produces:
  - `createTestQueryClient(): QueryClient` — `retry: false` em queries e mutations, `gcTime: Infinity`.
  - `renderWithProviders(ui: ReactElement, opts?: { queryClient?: QueryClient }): RenderResult & { queryClient: QueryClient }`
    — envolve em `QueryClientProvider` e `TooltipProvider`; registra `afterEach(cleanup)` uma vez.
  - `routerMock(overrides?: Partial<RouterMock>): RouterMock` — objeto para
    `vi.mock('@tanstack/react-router', () => routerMock())`, com `Link` (vira `<a href={to}>`, repassa
    `className`, `aria-*`, `onClick`), `Navigate` (`<p data-testid="navigate">{to}</p>`),
    `useNavigate` (devolve `navigateSpy`), `useSearch`, `useParams`, `useRouterState`, `useLocation`
    (devolvem `{}` ou o override). Exporta também `navigateSpy: Mock`.
  - `ANA`, `BRUNO`: `Account` iguais às fixtures (`user-ana`/`ana@kurio.test`/`Ana Souza`,
    `user-bruno`/`bruno@kurio.test`/`Bruno Lima`); `sessionOf(account | null): ReturnType<typeof useSession>`
    (visitante quando `null`).
  - `installDomPolyfills(): void` — idempotente; define `ResizeObserver` (no-op), `Element.prototype.scrollIntoView`,
    `hasPointerCapture`/`releasePointerCapture`/`setPointerCapture` e `window.matchMedia` (sempre `matches: false`)
    só quando ausentes. `render.tsx` chama no import.
  - `resetBrowserStorage(): void` — `localStorage.clear()` e `sessionStorage.clear()`; registrado em
    `afterEach` por `render.tsx`.

- [ ] **Step 1: Escrever `src/test/helpers.test.tsx` (jsdom) falhando**

Testes:
- `renderWithProviders dá um QueryClient novo a cada render` — dois renders, `queryClient` diferentes.
- `queries não fazem retry` — `useQuery` com `queryFn` rejeitando: `queryFn` chamado 1 vez e estado `error`.
- `storage é limpo entre testes (1/2)` grava `localStorage.setItem('kurio:session', 'x')`; `(2/2)` espera `null`.
- `routerMock: Link vira <a href>` e `useNavigate devolve navigateSpy`.
- `installDomPolyfills não sobrescreve implementação existente` — define `window.ResizeObserver = X` antes e confere que continua `X`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run src/test/helpers.test.tsx`
Expected: FAIL (`Cannot find module './render'`).

- [ ] **Step 3: Implementar os quatro arquivos com as assinaturas acima**

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run src/test/helpers.test.tsx`
Expected: PASS, 6 testes.

- [ ] **Step 5: Coverage, lint e commit**

Run: `pnpm test:coverage && pnpm lint`

```bash
git add src/test
git commit -m "test: helpers compartilhados de render, router, sessão e polyfills do DOM (COV-1)"
```

---

### Task COV-2: Harness MSW + handlers de conta

**Files:**
- Create: `src/test/mockServer.ts`
- Test: `src/mocks/handlers/auth.test.ts`, `src/mocks/handlers/profile.test.ts`, `src/mocks/handlers/wallets.test.ts`,
  `src/mocks/handlers/session.test.ts`

**Interfaces:**
- Consumes: `createStore` (`src/mocks/db/store.ts`), `getScenario` (`src/mocks/scenarios`), `apiClient`,
  `writeSession` / `SESSION_STORAGE_KEY` (`src/auth/sessionStorage.ts`), `FIXTURE_PASSWORD`.
- Produces (em `src/test/mockServer.ts`):
  - `createTestRuntime(name: ScenarioName = 'default'): { store: Store; scenario: Scenario }` — storage em
    memória e `latency: { kind: 'fixed', ms: 0 }`, sem `routeLatency`; demais campos do cenário intactos.
  - `allHandlers(): RequestHandler[]` — os mesmos arrays que `src/mocks/browser.ts` registra.
  - `useMockServer(): void` — `setupServer(...allHandlers())`, `listen({ onUnhandledRequest: 'error' })`
    no `beforeAll`, `resetHandlers` + `store.reset()` + `resetBrowserStorage()` no `afterEach`, `close` no `afterAll`.
  - `loginAs(email: 'ana@kurio.test' | 'bruno@kurio.test'): Promise<AuthResponse>` — `POST /auth/login` com
    `FIXTURE_PASSWORD` e `writeSession` do resultado, para o interceptor mandar o Bearer.

Uso em cada arquivo de handler (o cenário é fixo por arquivo, porque o `withScenario` cria o engine no import):

```ts
// @vitest-environment jsdom
vi.mock('@/mocks/runtime', async () => (await import('@/test/mockServer')).createTestRuntime('default'))
```

O jsdom é necessário para o axios usar o adapter XHR com URL relativa (`/api`); o `setupServer` intercepta XHR.
Se o import de `@/test/mockServer` dentro do `vi.mock` der ciclo, usar `vi.hoisted` com import dinâmico.

- [ ] **Step 1: `session.test.ts` (node, sem MSW) falhando**

`bearerToken` lê `Authorization: Bearer abc` → `'abc'`, sem header → `null`; `findSession` devolve `null` para
token desconhecido e para sessão vencida (`now` depois do `expiresAt`); `assertOwner` lança `Response` 403
para outra conta.

- [ ] **Step 2: `auth.test.ts` falhando**

- `POST /auth/login` com Ana e `Kurio#2026` → 200 com `account.email === 'ana@kurio.test'` e `token` string.
- senha errada → `ApiError` 401 com mensagem `'E-mail ou senha inválidos.'`.
- `POST /auth/signup` com e-mail da Ana → 409 `conflict`, `'Já existe uma conta com este e-mail.'`.
- signup vazio → 422 com `fieldErrors` `name`, `email` e `password` (`'A senha deve ter pelo menos 8 caracteres.'`).
- signup válido → 201 e o login seguinte com o mesmo e-mail funciona.
- `POST /auth/logout` com sessão → depois disso `GET /profile` dá 401.

- [ ] **Step 3: `profile.test.ts` e `wallets.test.ts` falhando**

Profile: `GET` sem token → 401; com Ana → `displayName: 'Ana'`; `PATCH` com nome de 61 caracteres → 422
(`MAX_DISPLAY_NAME = 60`); avatar acima de `MAX_AVATAR_LENGTH` → 422; troca de senha com a senha atual errada → erro de
campo; troca certa → login novo só funciona com a nova.
Wallets: Bruno lista `wallet-bruno-1` e `wallet-bruno-2`; criar com endereço inválido → 422; label com 41
caracteres → 422 (`MAX_LABEL = 40`); renomear, promover a principal e remover; Ana mexendo em `wallet-bruno-2`
→ 403 ou 404 (o que o handler devolve hoje); `POST /wallets/:id/connect` → sucesso.

- [ ] **Step 4: Rodar e ver falhar**

Run: `pnpm vitest run src/mocks/handlers`
Expected: FAIL (`Cannot find module '@/test/mockServer'`).

- [ ] **Step 5: Implementar `src/test/mockServer.ts` com as assinaturas acima**

- [ ] **Step 6: Rodar e ver passar; ajustar asserções de status ao que o handler realmente devolve**

Run: `pnpm vitest run src/mocks/handlers`
Expected: PASS. Uma asserção que diverge do handler é bug do teste, a menos que contradiga o `ARCHITECTURE.md`;
nesse caso, parar e reportar.

- [ ] **Step 7: Teste de isolamento (Review Focus 1)**

Em `wallets.test.ts`: `'cria carteira (1/2)'` cria uma terceira carteira do Bruno; `'seed volta (2/2)'` confere 2.

- [ ] **Step 8: Ratchet, lint e commit**

Run: `pnpm test:coverage && pnpm lint && pnpm typecheck`; subir thresholds para medido − 1.

```bash
git add src/test/mockServer.ts src/mocks/handlers/*.test.ts vite.config.ts
git commit -m "test: harness do MSW em teste e handlers de auth, perfil e carteiras (COV-2)"
```

---

### Task COV-3: Handlers de catálogo, carrinho, pedidos e cenários

**Files:**
- Test: `src/mocks/handlers/nfts.test.ts`, `cart.test.ts`, `quotes.test.ts`, `orders.test.ts`, `favorites.test.ts`,
  `health.test.ts`, `errors.test.ts`, `domain.test.ts`
- Test (um arquivo por cenário): `src/mocks/handlers/scenario.offline.test.ts`, `scenario.server-error.test.ts`,
  `scenario.favorite-fail.test.ts`, `scenario.coupon-invalid.test.ts`, `scenario.payment-declined.test.ts`,
  `scenario.wallet-rejected.test.ts`, `scenario.empty.test.ts`
- Test: `src/api/apiFunctions.test.ts` (funções finas de `src/api/*` que ainda não têm teste)

**Interfaces:**
- Consumes: `useMockServer`, `loginAs`, `createTestRuntime` (COV-2).

- [ ] **Step 1: Escrever os testes**

- `nfts`: `GET /nfts` devolve `DEFAULT_PAGE_SIZE = 12` itens e `total`; `pageSize=101` → 422 (`MAX_PAGE_SIZE = 100`);
  `page=abc` → 422; `GET /nfts/nft-002` → `Solar Veil`; id inexistente → 404 `not_found`; featured e facets respondem 200.
- `cart`: visitante → 401; Ana adiciona `nft-002` `1/10`, altera quantidade, remove; `merge` soma itens do visitante;
  cupom válido e inválido; `DELETE /cart/coupon`.
- `quotes`: carrinho com item → cotação com `subtotal`, `networkFee`, `total` e `expiresAt` no futuro.
- `orders`: sem `Idempotency-Key` → 4xx; mesma chave duas vezes → mesmo `id` (replay 200); Bruno lendo pedido da
  Ana → 403; sem token → 401.
- `favorites`: `PUT` e `DELETE /favorites/:nftId` refletem no `GET`.
- `health`: 200.
- `errors`: `apiError(404, 'not_found', 'x')` gera `Response` 404 com corpo `{ code, message }`; `readJson` de corpo
  inválido não lança; `str(1) === undefined`.
- `domain`: `domainGuard` converte erro de domínio do db em `Response` e repassa o resto.
- Cenários: `offline` → `ApiError` de rede (sem `status`); `server-error` → 503 `transient`
  `'Serviço indisponível. Tente novamente.'`, inclusive no login; `favorite-fail` → `PUT` 503 e `GET` 200;
  `coupon-invalid` → cupom recusado mesmo com código válido; `payment-declined` → pedido termina `declined`
  (usar `vi.useFakeTimers()` e avançar `DEFAULT_ORDER_SETTLE_MS = 2500`); `wallet-rejected` → `connect` falha;
  `empty` → `GET /nfts` com `total: 0`.
- `apiFunctions`: `addFavorite`/`removeFavorite`, `nftListQuery(...).queryFn`, `updateProfile`, `changePassword`,
  `createWallet`/`updateWallet`/`connectWallet`/`deleteWallet`, `login`/`signup`/`logout` contra o mock server.

- [ ] **Step 2: Rodar, ver passar e corrigir asserções ao comportamento real (mesma regra do COV-2 Step 6)**

Run: `pnpm vitest run src/mocks/handlers src/api`
Expected: PASS.

- [ ] **Step 3: Conferir o tempo da suíte**

Run: `pnpm vitest run src/mocks src/api --reporter=dot`
Expected: < 10s (latência 0). Se passar disso, um teste está esperando timer real.

- [ ] **Step 4: Ratchet e commit**

```bash
git add src/mocks/handlers src/api vite.config.ts
git commit -m "test: handlers de catálogo, carrinho, pedidos, favoritos e cenários de falha (COV-3)"
```

---

### Task COV-4: Smoke tests de `components/ui`

**Files:**
- Test: `src/components/ui/ui.smoke.test.tsx`
- Test: `src/components/ui/overlays.smoke.test.tsx` (Dialog, Sheet, DropdownMenu, Select, Tooltip)

**Interfaces:**
- Consumes: `renderWithProviders`, `installDomPolyfills` (COV-1).

Smoke = renderiza sem erro, o papel acessível existe, `className` extra é repassado, e a interação principal
funciona. Não testar estilo.

- [ ] **Step 1: `ui.smoke.test.tsx` com um `it` por componente**

`Avatar` (fallback com as iniciais quando sem imagem), `Badge` (texto e `badgeVariants({ variant })` devolve string),
`Breadcrumb` (`navigation` com `aria-label="breadcrumb"`, item atual com `aria-current="page"`), `Button`
(`role=button`, `disabled`, `asChild` vira `<a>`), `Card` (header/título/conteúdo/rodapé), `Checkbox`
(clique alterna `aria-checked`), `Field` (rótulo, descrição e erro ligados ao controle), `Input`, `Label`
(`htmlFor`), `Pagination` (`navigation`, link ativo com `aria-current="page"`), `RadioGroup` (seta muda a
seleção), `Separator`, `Skeleton`, `Slider` (`role=slider` com `aria-valuenow`; `ArrowRight` aumenta), `Tabs` (clique no
segundo `tab` mostra o segundo `tabpanel`), `Textarea`, `Toggle` (`aria-pressed` alterna), `ToggleGroup`
(single: só um `pressed`), `Toaster` (renderiza sem erro).

- [ ] **Step 2: `overlays.smoke.test.tsx`**

`Dialog`: abrir pelo gatilho → `role=dialog` com título; `Escape` fecha e o foco volta ao gatilho (Review Focus 4).
`Sheet`: abre e fecha pelo botão de fechar. `DropdownMenu`: abre com `pointerDown`/`Enter`, `menuitem` clicável,
`Escape` fecha e devolve o foco. `Select`: abre, escolhe opção, valor aparece no gatilho. `Tooltip`: foco no
gatilho mostra `role=tooltip`.

- [ ] **Step 3: Rodar**

Run: `pnpm vitest run src/components/ui`
Expected: PASS. Se o Radix reclamar de API do DOM ausente, adicionar o polyfill em `src/test/dom.ts` (não no teste).

- [ ] **Step 4: Ratchet e commit**

```bash
git add src/components/ui/*.smoke.test.tsx src/test/dom.ts vite.config.ts
git commit -m "test: smoke tests dos primitivos do shadcn (COV-4)"
```

---

### Task COV-5: `components/kurio`

**Files:**
- Test: `NftCard.test.tsx`, `FormField.test.tsx`, `FavoriteButton.test.tsx`, `WalletOption.test.tsx`, `WalletCard.test.tsx`,
  `AccountSidebar.test.tsx`, `StateMessage.test.tsx`, `QuantityStepper.test.tsx`, `EditionChips.test.tsx`,
  `OutOfScopeAction.test.tsx`, `PriceTag.test.tsx`, todos em `src/components/kurio/`
- Modify: `src/components/kurio/kit.test.tsx` (só se um caso do `CouponInput` faltar; não duplicar)

**Interfaces:**
- Consumes: `renderWithProviders`, `routerMock` (COV-1).

- [ ] **Step 1: Escrever os testes (jsdom, `vi.mock('@tanstack/react-router', () => routerMock())` onde houver `Link`)**

- `NftCard`: link para `/nfts/$nftId` com o nome, `<img>` com `width`/`height` do `nftArtSize`, `priority` liga
  `fetchpriority="high"`; `NftCardSkeleton` renderiza.
- `FormField`: rótulo ligado ao controle; erro vira `aria-invalid` + `aria-describedby` apontando para a mensagem.
- `FavoriteButton`: `aria-pressed` reflete `favorited`; clique chama o callback; nome acessível muda com o estado.
- `WalletOption`/`WalletOptionGroup`: monograma, seleção por clique e teclado, item desabilitado não seleciona.
- `WalletCard`/`WalletCardGroup`: mostra rede e endereço encurtado; ações do menu chamam os callbacks.
- `AccountSidebar`: links da conta, item atual com `aria-current`.
- `StateMessage`: `EmptyState` com título/ação; `ErrorState` com "Tentar novamente" chamando `onRetry`.
- `QuantityStepper`: `−` desabilitado no mínimo, `+` desabilitado no máximo, digitação fora da faixa é ajustada.
- `EditionChips`: só uma edição pressionada; edição esgotada desabilitada.
- `OutOfScopeAction`: botão com `aria-disabled` e tooltip explicando.
- `PriceTag`: formata ETH com `formatEth`.

- [ ] **Step 2: Rodar**

Run: `pnpm vitest run src/components/kurio`
Expected: PASS; no relatório, nenhum arquivo de `components/kurio` abaixo de 80% de linhas.

- [ ] **Step 3: Ratchet e commit**

```bash
git add src/components/kurio vite.config.ts
git commit -m "test: componentes do kit Kurio (COV-5)"
```

---

### Task COV-6: `components/layout`

**Files:**
- Test: `SiteHeader.test.tsx`, `HeaderSearch.test.tsx`, `AccountMenu.test.tsx`, `SessionLink.test.tsx`,
  `MobileTabBar.test.tsx`, `SkipLink.test.tsx`, `SiteFooter.test.tsx` (inclui `BrandLogo`), todos em
  `src/components/layout/`

**Interfaces:**
- Consumes: `renderWithProviders`, `routerMock`, `sessionOf`, `ANA` (COV-1). Mockar `@/auth/useSession`,
  `@/features/cart/useCartCount` e `@/features/account/useSignOut` com `vi.mock`.

- [ ] **Step 1: Escrever os testes**

- `HeaderSearch`: submit com texto chama `navigateSpy` com `to: '/'` e `search` contendo o termo; submit vazio
  remove o termo; o valor inicial vem do `useSearch`.
- `AccountMenu`: visitante vê "Entrar" (link com `redirect`); Ana vê o nome, abre o menu e "Sair" chama o `signOut` mockado.
- `SessionLink`: `isPending` mostra skeleton; visitante vai para `/login` com `redirect` do pathname atual.
- `SiteHeader`/`MobileTabBar`: badge do carrinho com a contagem do `useCartCount`; aba atual com `aria-current`.
- `SkipLink`: `href="#<MAIN id>"`; clique foca o `main`.
- `SiteFooter`/`BrandLogo`: logo linka para `/`.

- [ ] **Step 2: Rodar, ratchet e commit**

Run: `pnpm vitest run src/components/layout`
Expected: PASS; nenhum arquivo de `components/layout` com 0%.

```bash
git add src/components/layout vite.config.ts
git commit -m "test: header, menu da conta, busca e navegação (COV-6)"
```

---

### Task COV-7: Conta: entrar, cadastrar e sair

**Files:**
- Test (todos em `src/features/account/`): `LoginForm.test.tsx`, `SignupForm.test.tsx`, `AuthDialog.test.tsx`,
  `PasswordInput.test.tsx`, `useAuthForm.test.tsx`, `useSignOut.test.tsx`, `authGuards.test.ts`

**Interfaces:**
- Consumes: COV-1 helpers. API mockada no padrão do `CheckoutPage.test.tsx`
  (`vi.mock('@/api/client', () => ({ apiClient: api }))`), ou `useMockServer` (COV-2) quando o teste precisar do 401/409 real.

- [ ] **Step 1: Escrever os testes**

- `LoginForm`: envio vazio mostra os erros e não chama a API; credencial errada mostra
  `'E-mail ou senha inválidos.'` e mantém o diálogo aberto; sucesso chama `sessionLifecycle.establishSession`
  e navega para o `redirect`.
- `SignupForm`: envio vazio mostra 4 erros sem request; 409 mostra `'Já existe uma conta com este e-mail.'` no campo
  e-mail com o link "Entrar com este e-mail" mantendo o `redirect`; foco vai para o primeiro campo inválido (`firstInvalidField`).
- `PasswordInput`: botão alterna `type` entre `password` e `text` e o nome acessível do botão.
- `AuthDialog`: abre como `role=dialog`; `Escape` navega para o `dialogCloseTarget`; `FormAlert` tem `role=alert`.
- `useAuthForm`: sucesso chama `establishSession` uma vez; erro de campo vira `fieldErrors`.
- `useSignOut`: chama `endSession`, mostra o toast de saída e chama `focusMainContent`.
- `authGuards`: `toLogin` monta redirect com o `href` atual; `authenticatedDestination` com sessão gravada devolve o
  destino, sem sessão devolve `null` (conferir assinaturas no arquivo).

- [ ] **Step 2: Rodar, ratchet e commit**

Run: `pnpm vitest run src/features/account`
Expected: PASS.

```bash
git add src/features/account vite.config.ts
git commit -m "test: login, cadastro, diálogo de autenticação e saída (COV-7)"
```

---

### Task COV-8: Conta: perfil, senha, avatar e carteiras

**Files:**
- Test (em `src/features/account/`): `ProfileForm.test.tsx`, `PasswordForm.test.tsx`, `AvatarField.test.tsx`,
  `WalletList.test.tsx`, `WalletForm.test.tsx`, `WalletDialogs.test.tsx`, `AccountLayout.test.tsx`
  (inclui `AccountPanel`), `useAccountForm.test.tsx`
- Modify: `src/features/account/avatar.test.ts` (casos de `readAsDataUrl` e `checkAvatarFile` que faltam)

**Interfaces:**
- Consumes: COV-1 helpers, `useMockServer`/`loginAs` (COV-2) quando útil.

- [ ] **Step 1: Escrever os testes**

- `useAccountForm`: valida antes de enviar; erro 422 vira erro de campo; erro genérico vira alerta;
  **sessão trocada com a request em voo: `onSuccess` não roda** (`captureSession` devolvendo `false`; Review Focus 3).
- `ProfileForm`: carrega o nome, nome vazio mostra erro, sucesso mostra toast `'Perfil atualizado.'`; e o caso da
  sessão trocada sem toast (Review Focus 3).
- `PasswordForm`: senhas diferentes → erro; senha atual errada → erro no campo; sucesso limpa o formulário.
- `AvatarField`: arquivo grande ou de tipo errado mostra erro sem request; arquivo válido manda o data URL; remover avatar.
- `avatar.ts`: `readAsDataUrl` resolve com `data:`; `checkAvatarFile` nos limites `AVATAR_MAX...`.
- `WalletList`: lista e skeleton; promover a principal e remover pela confirmação; erro mostra toast; sessão trocada
  em voo não invalida `['wallets', id]` (Review Focus 3).
- `WalletForm`: endereço inválido e label > 40 mostram erro; rede pelo `Select`; sucesso limpa e invalida.
- `WalletDialogs`: renomear valida e salva; remover pede confirmação e fecha.
- `AccountLayout`/`AccountPanel`: título, navegação da conta e "Sair".

- [ ] **Step 2: Rodar, ratchet e commit**

Run: `pnpm vitest run src/features/account`
Expected: PASS; `features/account` ≥ 80% de linhas.

```bash
git add src/features/account vite.config.ts
git commit -m "test: perfil, senha, avatar e carteiras com guarda de sessão (COV-8)"
```

---

### Task COV-9: Catálogo (Início)

**Files:**
- Test (em `src/features/catalog/`): `CatalogFilters.test.tsx`, `CatalogGrid.test.tsx`, `CatalogPagination.test.tsx`,
  `CatalogSection.test.tsx`, `CatalogToolbar.test.tsx`, `HeroFeatured.test.tsx`, `NftGrid.test.tsx`,
  `useCatalogSearch.test.tsx`, `static.test.tsx` (`MintJournal` e `PromoCards`)

**Interfaces:**
- Consumes: COV-1 helpers (`routerMock` com `useSearch` controlável), `useMockServer` (COV-2) para as queries de NFTs.

- [ ] **Step 1: Escrever os testes**

- `useCatalogSearch`: lê o search validado e `setSearch` chama `navigateSpy` com `replace`/`resetScroll` do código e `page` voltando a 1 ao mudar filtro.
- `CatalogFilters`: marcar coleção atualiza `collections`; slider de preço muda `minPrice`/`maxPrice`; "Limpar" zera; skeleton enquanto as facets carregam.
- `CatalogToolbar`: ordenação pelo `Select` muda `sort`; abas mudam o filtro; no mobile, o `Sheet` de filtros abre.
- `CatalogGrid`: carregando → skeleton; vazio → `EmptyState` com limpar filtros; erro (`server-error` ou 503 mockado) →
  `ErrorState` e "Tentar novamente" refaz a request (Review Focus 5); sucesso mostra 12 cards.
- `CatalogPagination`: página atual com `aria-current`, anterior desabilitado na 1, links com `page` correto.
- `NftGrid`: um card por NFT; `NftGridSkeleton` com `count` cards.
- `HeroFeatured`: mostra o destaque e o CTA para o detalhe; skeleton enquanto carrega.
- `CatalogSection`, `MintJournal`, `PromoCards`: renderizam com os dados do mock e os links esperados.

- [ ] **Step 2: Rodar, ratchet e commit**

Run: `pnpm vitest run src/features/catalog`
Expected: PASS; nenhum arquivo de `features/catalog` com 0%.

```bash
git add src/features/catalog vite.config.ts
git commit -m "test: catálogo do Início com filtros, grid, paginação e destaque (COV-9)"
```

---

### Task COV-10: Detalhe, favoritos, pedidos, lacunas de carrinho e checkout

**Files:**
- Test: `src/features/nft-detail/NftGallery.test.tsx`, `MoreFromCollection.test.tsx`, `MobileDetailChrome.test.tsx`,
  `NftInfo.test.tsx` (inclui `NftDetailSkeleton` e `layout.ts`)
- Test: `src/features/favorites/FavoriteButton.test.tsx`, `src/features/favorites/useToggleFavorite.test.tsx`
- Test: `src/features/orders/OrderStatusView.test.tsx`
- Modify: `src/features/cart/CartPage.test.tsx`, `src/features/checkout/reviewSnapshot.test.ts`, criar
  `src/features/checkout/usePlaceOrder.test.tsx`, `src/features/cart/QuoteErrorState.test.tsx`

- [ ] **Step 1: Escrever os testes**

- `NftGallery`: miniatura troca a imagem principal; a atual com `aria-current`/`aria-pressed`.
- `MoreFromCollection`: exclui o NFT atual; vazio não renderiza a seção.
- `MobileDetailChrome`: header com voltar; barra de compra chama `AddToCartButton` com a seleção.
- `NftInfo`: breadcrumb com coleção linkando para o Início filtrado; rede e criador.
- `useToggleFavorite`: visitante navega para `/login` com `redirect`; logado faz otimista e, com falha, desfaz e mostra
  o toast (o `favoriteCache` já é testado; aqui só o hook).
- `FavoriteButton` (feature): liga o kit ao hook.
- `OrderStatusView`: `pending`, `confirmed` (recibo) e `declined` (CTA de voltar ao checkout).
- Carrinho e checkout: ler o relatório `coverage/index.html` e escrever um teste por bloco não coberto de `CartPage.tsx`,
  `QuoteErrorState.tsx`, `reviewSnapshot.ts` e `usePlaceOrder.ts`, até cada um passar de 85% de linhas.

- [ ] **Step 2: Rodar, ratchet e commit**

Run: `pnpm vitest run src/features`
Expected: PASS.

```bash
git add src/features vite.config.ts
git commit -m "test: detalhe do NFT, favoritos, status do pedido e lacunas de carrinho e checkout (COV-10)"
```

---

### Task COV-11: Rotas e fechamento em 80%

**Files:**
- Test: `src/routes/routes.test.ts` (guards, `validateSearch`, loaders e `head`)
- Test: `src/realtime/socket.test.ts`, `src/mocks/devtools.test.ts` (casos que faltam)
- Modify: `vite.config.ts` (thresholds 80/80/80/80)
- Modify: `ARCHITECTURE.md` (seção de testes e a linha "os componentes de formulário de conta (M3) não têm teste
  automatizado"), `README.md` (tabela de scripts com `test:coverage`)
- Modify: `docs/superpowers/specs/2026-11-01-aumento-coverage-design.md` (status "concluído" e medição final)

- [ ] **Step 1: Escrever `routes.test.ts`**

Chamar `Route.options.beforeLoad`/`loader`/`validateSearch` direto, com `queryClient` de `createTestQueryClient()`:
- `_authenticated`: sem sessão lança `redirect` para `/login` com o `redirect` do `location.href`; com sessão segue.
- `login`/`signup`: `validateSearch` só aceita `redirect` interno; com sessão, `beforeLoad` redireciona para o destino.
- `index`: `loaderDeps` = `toListParams(search)`; `loader` faz prefetch da lista.
- `nfts.$nftId`: `validateSearch` descarta edição inválida; `loader` com id inexistente lança `notFound`; `head` usa
  `'<nome> · Kurio'` e `'NFT · Kurio'` sem dados.
- `orders.$orderId`: `loader` busca o pedido da conta.
Os `component` de rota ficam cobertos pelas features; se algum ficar abaixo de 80% e puxar a média, renderizar com `routerMock`.

- [ ] **Step 2: Rodar o coverage completo e fechar os buracos**

Run: `pnpm test:coverage`
Expected: as quatro métricas ≥ 80%. Se branches ficar abaixo, abrir `coverage/index.html`, ordenar por branches e
cobrir os maiores arquivos primeiro.

- [ ] **Step 3: Thresholds finais `80/80/80/80` e verificação limpa**

Run: `pnpm lint && pnpm typecheck && pnpm test:coverage`
Expected: tudo verde, sem `ERROR: Coverage ... does not meet global threshold`.

- [ ] **Step 4: Docs e commit**

```bash
git add src/routes src/realtime src/mocks vite.config.ts ARCHITECTURE.md README.md docs/superpowers
git commit -m "test: rotas, thresholds finais em 80% e documentação (COV-11)"
```
