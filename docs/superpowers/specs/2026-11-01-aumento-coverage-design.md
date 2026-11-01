# SDD: aumento do coverage de testes

- **Data:** 2026-11-01
- **Autor:** Bruno Cabral (com Claude)
- **Status:** aprovado com ajustes (ver seção 7); plano em `docs/superpowers/plans/2026-11-01-aumento-coverage.md`
- **Time no Linear:** Mykas (`MYK-`)
- **Branch alvo:** `develop`

## 1. Contexto

O projeto tem 58 arquivos de teste e 542 testes, todos passando (`vitest run`, ~5s). A camada de domínio
está bem coberta: `lib`, `mocks/db`, `mocks/scenarios`, `contracts`, `auth`, `realtime`, `features/cart` e
`features/checkout`. Quase não há teste de componente fora do carrinho e do checkout, e o `ARCHITECTURE.md`
já admite isso ("os componentes de formulário de conta (M3) não têm teste automatizado").

Hoje o coverage não é medido: `@vitest/coverage-v8` não está instalado, não há bloco `test` no
`vite.config.ts`, nem script, nem threshold no CI.

### 1.1 Medição de partida (2026-11-01, commit `11bc08a`)

Medido com `@vitest/coverage-v8@5.0.5` instalado só para a medição (revertido depois), sobre
`src/**/*.{ts,tsx}`, sem `*.test.*`, `routeTree.gen.ts` e `vite-env.d.ts`.

| Métrica | Tudo em `src` | Sem os excluídos da seção 4.2 |
|---|---|---|
| Linhas | **57,4%** (1762/3068) | **60,9%** (1741/2861) |
| Statements | 58,1% (2096/3606) | 61,2% (2075/3388) |
| Branches | 55,2% (1548/2803) | 57,1% (1530/2680) |
| Funções | 50,2% (573/1141) | 55,9% (561/1004) |

Por pasta (linhas):

| Pasta | Arquivos | Arquivos com 0% | Linhas cobertas | % |
|---|---:|---:|---:|---:|
| `src/lib` | 9 | 0 | 109/110 | 99,1 |
| `src/mocks/db` | 12 | 0 | 306/307 | 99,7 |
| `src/mocks/scenarios` | 4 | 0 | 42/42 | 100 |
| `src/contracts` | 14 | 0 | 10/10 | 100 |
| `src/realtime` | 6 | 0 | 89/93 | 95,7 |
| `src/auth` | 4 | 0 | 114/120 | 95,0 |
| `src/features/cart` | 13 | 0 | 237/262 | 90,5 |
| `src/features/checkout` | 15 | 0 | 402/447 | 89,9 |
| `src/api` | 9 | 0 | 98/115 | 85,2 |
| `src/features/orders` | 3 | 1 | 11/19 | 57,9 |
| `src/components/kurio` | 14 | 3 | 63/110 | 57,3 |
| `src/features/favorites` | 3 | 2 | 24/53 | 45,3 |
| `src/features/nft-detail` | 9 | 5 | 18/62 | 29,0 |
| `src/features/account` | 19 | 16 | 78/346 | **22,5** |
| `src/mocks/handlers` | 14 | 8 | 73/440 | **16,6** |
| `src/components/ui` (shadcn) | 24 | 15 | 21/139 | 15,1 |
| `src/features/catalog` | 10 | 10 | 0/120 | **0** |
| `src/components/layout` | 8 | 8 | 0/63 | **0** |
| `src/routes` | 13 | 13 | 0/78 | **0** |
| `src/app`, `main.tsx`, `mocks/browser.ts`, `mocks/socket.ts`, `mocks/lifecycle.ts` | 8 | 6 | 3/62 | ~5 |

### 1.2 Problema encontrado na medição

O Vitest sem `include` varre a raiz inteira e **roda também os testes de `.claude/worktrees/*`**: na
máquina local, `pnpm test` achou 119 arquivos (1116 testes, 42 falhando por versões antigas nos
worktrees) em vez de 58. No CI isso não aparece porque o checkout não tem worktrees, mas localmente o
resultado de `pnpm test` é enganoso. A Fase 0 corrige isso.

## 2. Objetivos

1. Medir o coverage em todo PR e impedir que ele caia (threshold no CI).
2. Levar o coverage global (com as exclusões da seção 4.2) de **~59% para ≥ 80% em linhas, statements,
   funções e branches**, priorizando `components/` (inclusive smoke tests do shadcn) e os arquivos com 0%.
3. Criar utilitários de teste compartilhados para que testes de componente novos não repitam o andaime
   de mocks (`apiClient`, router, sessão, `QueryClient`) que hoje está copiado em cada `*.test.tsx`.

### Fora de escopo

- Playwright/E2E (já previsto para o M5/M6 no README).
- Testes de comportamento profundo dos primitivos do shadcn (`src/components/ui` recebe só smoke tests).
- Testes visuais/snapshot e Lighthouse.
- Refatorar código de produção, exceto quando um arquivo for impossível de testar sem isso (registrar
  no PR o motivo).

## 3. Critérios de aceite

- `pnpm test:coverage` existe, roda em node + jsdom e gera `text-summary` e `json-summary`.
- `pnpm test` roda **só** `src/**/*.test.{ts,tsx}` (worktrees fora).
- O job `test` do CI roda com coverage e falha abaixo dos thresholds.
- Thresholds finais: linhas, statements, funções e branches ≥ 80.
- Cada arquivo de `src/components/ui` tem pelo menos um smoke test (renderiza, papel acessível, interação principal).
- Nenhum arquivo fora de 4.2 fica com 0% de linhas.
- `ARCHITECTURE.md` e `README.md` atualizados (seção de testes e a frase sobre formulários de conta).

## 4. Desenho

### 4.1 Configuração (`vite.config.ts`)

```ts
/// <reference types="vitest/config" />
export default defineConfig({
  // ...plugins e resolve atuais
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [/* seção 4.2 */],
      reporter: ['text-summary', 'json-summary', 'html'],
      thresholds: { lines: 60, statements: 60, functions: 55, branches: 55 }, // sobe a cada fase
    },
  },
})
```

- `package.json`: `"test:coverage": "vitest run --coverage"` e `@vitest/coverage-v8` na mesma versão
  do `vitest` (5.0.5).
- `coverage/` no `.gitignore`.
- CI: o job `test` passa a rodar `pnpm test:coverage`.
- O ambiente continua por arquivo (`// @vitest-environment jsdom`), como hoje. Não mudar o default
  para jsdom: os testes de domínio rodam em node de propósito.

### 4.2 Exclusões do coverage

| Arquivo/pasta | Motivo |
|---|---|
| `src/**/*.test.{ts,tsx}`, `src/test/**` | testes e utilitários de teste |
| `src/routeTree.gen.ts`, `src/vite-env.d.ts` | gerado / só tipos |
| `src/main.tsx`, `src/app/start.tsx` | bootstrap do app (render no DOM real) |
| `src/mocks/browser.ts`, `src/mocks/socket.ts`, `src/mocks/lifecycle.ts` | bootstrap do service worker e do socket do MSW no browser |
| `src/routes/dev.*.tsx` | páginas de dev (kit e tokens) |

Qualquer exclusão nova precisa de justificativa no PR. As demais rotas **não** são excluídas (ver
Fase 5).

### 4.3 Utilitários de teste (`src/test/`)

Hoje cada `*.test.tsx` repete `vi.mock('@/api/client')`, `vi.mock('@tanstack/react-router')`,
`vi.mock('@/auth/useSession')` e o `QueryClientProvider`. Proposta:

- `src/test/render.tsx`: `renderWithProviders(ui, { queryClient? })` com um `QueryClient` de teste
  (`retry: false`, `gcTime: Infinity`) e `cleanup` automático.
- `src/test/routerMock.tsx`: fábrica do mock do `@tanstack/react-router` (`Link` vira `<a href>`,
  `Navigate`, `useNavigate`, `useSearch`, `useParams`) para usar em `vi.mock(..., () => routerMock())`.
- `src/test/session.ts`: contas de teste (`ANA`, `BRUNO`, visitante) e o mock de `useSession`.
- `src/test/mockServer.ts`: `setupServer` do `msw/node` com os handlers reais de `src/mocks/handlers` e reset
  do store/cenário entre testes (Fase 1).

`vi.mock` precisa ser chamado no próprio arquivo de teste (hoisting); os utilitários só fornecem as
fábricas. Os testes existentes **não** precisam migrar; migrar quando forem tocados.

### 4.4 Estratégia por camada

- **Componentes puros (`components/kurio`, `components/layout`, partes do catálogo):** Testing Library
  em jsdom, consultando por papel/rótulo acessível (`getByRole`, `getByLabelText`). Cobrir estados
  (vazio, carregando, erro, desabilitado) e interações (clique, teclado).
- **Componentes com dados (`features/*`):** mock do `apiClient` como no `CheckoutPage.test.tsx`, ou
  MSW em node quando o fluxo depende do comportamento real do servidor (erros de domínio, 401/409).
- **Hooks (`useAccountForm`, `useToggleFavorite`, `useSignOut`, `useCatalogSearch`):** `renderHook` com
  `QueryClient` real; para mutations da conta, conferir a guarda de sessão (`captureSession`) descrita
  no `ARCHITECTURE.md`.
- **Handlers do MSW (`mocks/handlers`):** testes de integração em node com `setupServer` + o
  `apiClient` real (axios), exercitando status, corpo `ApiErrorBody` e cenários via `withScenario`. Isso
  cobre de uma vez os handlers e as funções finas de `src/api/*` que faltam (`favorites`, `nfts`,
  `profile`, `wallets`, `auth`).
- **Rotas (`src/routes`):** testar o que tem lógica: `beforeLoad`/guards de `_authenticated.tsx`,
  `validateSearch` e loaders. O `component` das rotas só monta a feature e é coberto pelos testes das
  features.

## 5. Plano por fases e esforço

Estimativa para 1 dev com assistência do Claude. "Linhas a cobrir" = linhas hoje sem cobertura no grupo.

| Fase | Escopo | Arquivos | Linhas a cobrir | Esforço | Coverage esperado ao fim (linhas) |
|---|---|---:|---:|---|---|
| **0. Infra** | 4.1, 4.2, 4.3, CI, threshold = baseline | — | — | 0,5 dia | ~61% (medição real) |
| **1. Handlers do MSW + `api/*`** | `mocks/handlers/*` (auth, cart, favorites, nfts, orders, profile, quotes, session, wallets, errors, withScenario, domain, health) e `api/*` | 18 | ~385 | 2 dias | ~72% |
| **2. `components/`** | `components/kurio` (NftCard, FormField, FavoriteButton, WalletOption, AccountSidebar, StateMessage, CouponInput, QuantityStepper, EditionChips, OutOfScopeAction) e `components/layout` (SiteHeader, HeaderSearch, AccountMenu, SessionLink, MobileTabBar, SkipLink, SiteFooter, BrandLogo) | 18 | ~110 | 1,5 dia | ~76% |
| **3. `features/account`** | LoginForm, SignupForm, ProfileForm, PasswordForm, PasswordInput, AuthDialog, AvatarField, WalletList, WalletForm, WalletDialogs, AccountLayout, AccountPanel, `useAccountForm`, `useAuthForm`, `useSignOut`, `authGuards`, `avatar.ts` | 17 | ~270 | 3 dias | ~85% |
| **4. Catálogo, detalhe, favoritos, pedidos, carrinho** | `features/catalog/*` (10), `nft-detail` (NftGallery, MoreFromCollection, MobileDetailChrome, NftInfo, Skeleton, layout), `favorites` (FavoriteButton, useToggleFavorite), `orders/OrderStatusView`, lacunas de `CartPage`, `QuoteErrorState`, `reviewSnapshot`, `usePlaceOrder` | ~22 | ~260 | 2,5 dias | ~92% |
| **5. Rotas e fechamento** | guards/loaders/`validateSearch` em `src/routes`, `realtime/socket.ts`, `mocks/devtools.ts`; thresholds finais; docs | ~13 | ~85 | 1 dia | ≥ 92% |
| **Total** | | ~88 | ~1110 | **~10,5 dias** | |

O "coverage esperado" assume ~85% de cobertura das linhas tocadas em cada fase. A meta de 80% sai ao fim
da Fase 3; as Fases 4 e 5 dão a folga (sobretudo em branches) e zeram os arquivos com 0%. Os smoke tests
de `components/ui` (task COV-4 do plano) somam ~0,5 dia à Fase 2.

### Por que essa ordem

1. **Fase 1 antes dos componentes:** é o maior ganho por esforço (440 linhas num lugar só, sem DOM) e o
   `setupServer` vira infraestrutura para os testes de feature das fases seguintes.
2. **Fase 2 é o pedido explícito** (componentes) e é barata: componentes pequenos e quase todos puros.
3. **Fase 3 é o maior risco de produto:** login, cadastro, perfil, senha e carteiras não têm nenhum teste,
   e é onde mora a guarda de sessão entre contas.
4. **Fase 4** completa as telas públicas (Início e Detalhe).

### Ratchet do threshold

Cada fase termina subindo os thresholds para o valor medido arredondado **para baixo** em 1 ponto (ex.:
mediu 72,4% → `lines: 71`). Assim o CI trava regressões sem ficar quebradiço.

### Tasks

As fases foram refinadas nas tasks `COV-0` a `COV-11`, com dependências, esforço e status no backlog do
plano (`docs/superpowers/plans/2026-11-01-aumento-coverage.md`). Cada task vira um PR para `develop` e,
quando o Linear tiver cota, uma subtask `MYK-` da task-mãe "Aumentar coverage de testes para ≥ 80%".

## 6. Riscos e decisões em aberto

- **Radix em jsdom:** `Select`, `DropdownMenu`, `Dialog`, `Sheet` e `Slider` usam pointer events,
  `ResizeObserver` e `scrollIntoView`, que o jsdom não tem. Pode ser preciso um `src/test/dom.ts`
  com polyfills, carregado pelos arquivos jsdom. Afeta principalmente `CatalogFilters`, `AccountMenu`,
  `AuthDialog` e `WalletDialogs`; reservar folga na Fase 3 e 4.
- **Latência do cenário:** `withScenario` espera latência antes do resolver; nos testes usar o cenário
  sem latência ou `vi.useFakeTimers()` para não deixar a suíte lenta.
- **Tempo da suíte:** hoje ~5s. Com ~60 arquivos jsdom novos deve ir para 15–25s. Aceitável; se passar
  de 60s, avaliar `isolate: false` para os arquivos node.
- **Runtime do mock singleton:** o `withScenario` cria o engine no import, então o cenário é fixo por
  arquivo de teste. Decisão: `vi.mock('@/mocks/runtime')` com um runtime de teste (storage em memória,
  latência 0) e um arquivo por cenário. Não exige mudar `mocks/runtime.ts`.

## 7. Registro de alterações e refinamentos

| Data | Alteração | Motivo |
|---|---|---|
| 2026-11-01 | Meta final passa de 85% de linhas / 80% de branches para **80% nas quatro métricas** | decisão do Bruno |
| 2026-11-01 | `src/components/ui` **sai da lista de exclusões** e ganha smoke tests (task COV-4, +0,5 d) | decisão do Bruno; baseline com ui incluído fica ~59% de linhas |
| 2026-11-01 | As tasks não vão para o Linear agora: o backlog fica na tabela do plano (IDs `COV-0` a `COV-11`) e vira subtasks `MYK-` quando houver cota | Linear sem cota para criar issues |
| 2026-11-01 | Fases da seção 5 refinadas em 12 tasks: a Fase 0 vira COV-0 (infra) + COV-1 (helpers); handlers em COV-2/COV-3; `components/` em COV-4 (ui), COV-5 (kurio), COV-6 (layout); conta em COV-7/COV-8; catálogo em COV-9; demais features em COV-10; rotas e fechamento em COV-11 | tasks menores, cada uma com um PR revisável e o próprio ratchet |
| 2026-11-01 | Harness do MSW definido: jsdom + `setupServer` + `apiClient` real, `vi.mock('@/mocks/runtime')` com latência 0 | o axios precisa do adapter XHR para URL relativa; latência de 150 ms por request deixaria a suíte lenta |
| 2026-11-01 | Esforço total revisto de ~10,5 para **~11,5 dias** | smoke tests de ui e helpers separados |
