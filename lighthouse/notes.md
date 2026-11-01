## Antes e depois das correções (MYK-1116)

Primeira medição (commit 1872966, mesmo ambiente), medianas:

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|---|
| Início | mobile | 72 | 100 | 100 | 83 | 4164 ms | 0.000 | 574 ms |
| Início | desktop | 97 | 100 | 100 | 83 | 1270 ms | 0.000 | 1 ms |
| Detalhe | mobile | 70 | 100 | 100 | 83 | 4009 ms | 0.000 | 675 ms |
| Detalhe | desktop | 96 | 100 | 100 | 83 | 1341 ms | 0.000 | 29 ms |

Correções aplicadas:

- SEO 83 → 100: `<meta name="description">` no `index.html` (auditoria `meta-description`) e `public/robots.txt`, com `robots\.txt` fora do rewrite SPA do `vercel.json` (auditoria `robots-txt`: antes o `/robots.txt` devolvia o `index.html`, "14 errors found").
- LCP do Início no mobile: o elemento de LCP é o 1º card do catálogo (176×176), que carregava com `loading="lazy"` e sem `fetchpriority` (`lcp-discovery-insight`). Os 2 primeiros cards da grade (1ª linha do mobile) agora carregam `eager` com `fetchpriority="high"` (`NftGrid`, `ABOVE_THE_FOLD`). Na medição final o item "LCP resources shouldn't use loading=lazy" passa, mas o LCP não mudou além do ruído: o `resourceLoadDelay` (~720 ms, a imagem só existe depois do mock responder) domina, e o Lighthouse ainda marca `priorityHinted` como falso para o elemento de LCP (a investigar). A variação entre execuções no Início mobile é alta (49 a 75).
- A miniatura do próximo destaque no hero mobile (acima da dobra) perdeu o `loading="lazy"`.

## Justificativa do que ficou abaixo da meta

**Performance no mobile (Início e Detalhe), meta 90.** Causas lidas nos relatórios (`bootup-time`, `total-blocking-time`, `lcp-breakdown-insight`, `network-dependency-tree-insight`):

1. **MSW no build de demonstração.** O build publicado é a demo com a API simulada (`VITE_ENABLE_MOCKS=true`). O chunk `browser-*.js` (MSW + seed dos mocks + binding do Socket.IO, ~470 kB, ~174 kB gzip) é baixado, avaliado e o Service Worker é registrado **antes** do primeiro render (`src/main.tsx`): sem isso o socket abre um WebSocket real e o mock não intercepta (R1). Com CPU 4x, só esse chunk custa ~1,3 s de execução de script, o que domina o TBT (~600 ms) e atrasa o início do render.
2. **LCP dependente de dados.** A imagem do LCP (1º card no Início, arte principal no Detalhe) só é descoberta depois que a resposta do mock chega (latência fixa de 150 ms do cenário `default`) e o React renderiza: o `resourceLoadDelay` fica em ~700 ms no 4G lento simulado. A imagem em si carrega em ~70–100 ms.
3. O CSS de entrada (~20 kB) é render-blocking (`render-blocking-insight`, ~300 ms estimados), o que é o padrão do Vite/Tailwind.

O §10 proíbe simplificações exclusivas para a pontuação: o MSW, a latência do cenário e o socket fazem parte da entrega e não foram desligados. Em produção real (API de verdade, sem MSW), o chunk `browser-*` some e o LCP deixa de esperar o Service Worker. No desktop (CPU 1x, rede rápida) as duas páginas passam a meta.

**Limitações conhecidas (não feitas por prazo).** `<picture>` com AVIF e `srcset` 320/960 para as artes (`public/nfts/macaco-*`, já geradas pela MYK-1079): hoje todas as artes usam o WebP de 960, o que pesa nas miniaturas (carrinho, galeria, hero). O CLS do skeleton do carrinho do visitante e o hex fixo do gradiente do hero mobile também ficaram para depois; o CLS medido nas páginas auditadas é 0.
