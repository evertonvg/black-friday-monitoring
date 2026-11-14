# Monitor de Preços — Marco 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar no ar, o quanto antes, um app pessoal que busca produtos no Mercado Livre, KaBuM e Amazon, guarda a lista, coleta preços periodicamente e mostra melhor preço do dia + histórico.

**Architecture:** Monolito Nuxt 4 (TypeScript). Servidor Nitro expõe a API, roda o agendador (`croner`) e acessa SQLite via Drizzle. Cada loja é um adaptador com fetch HTTP (`got-scraping`) separado de parsers puros (`cheerio`), testados com fixtures reais. UI em Nuxt UI + ECharts. Deploy em Docker + Caddy.

**Tech Stack:** Node 24 LTS, pnpm, Nuxt 4, Nuxt UI 4, Drizzle ORM + better-sqlite3, drizzle-kit, zod, got-scraping, cheerio, p-retry, p-limit, croner, nuxt-auth-utils, vue-echarts + echarts, Vitest, @nuxt/test-utils.

**Spec:** `docs/superpowers/specs/2026-11-14-price-monitor-design.md` (seções 9.1 = este plano; Marco 2 e 3 terão planos próprios).

## Global Constraints

- Projeto na raiz de `black-friday-monitoring/`; trabalho direto na `main`.
- **Nuxt 4** (versão estável atual; o layout `app/` + `server/` da spec é o do Nuxt 4). TypeScript `strict`.
- Preços sempre em **centavos inteiros** (`number`), nunca float. Datas gravadas em UTC (`integer` timestamp ms); exibição em `America/Sao_Paulo`, formato `pt-BR`, moeda `BRL`.
- Módulos em `server/stores`, `server/collector`, `server/services`, `server/db` usam **imports explícitos** (sem auto-imports do Nitro) e recebem `db` por parâmetro, para rodar no Vitest puro. Só `server/api`, `server/plugins`, `server/middleware` e `server/utils` usam auto-imports.
- IDs de loja (`StoreId`): `'mercadolivre' | 'kabum' | 'amazon'` neste marco.
- Marco 1 é **só HTTP** (`got-scraping`); Playwright entra no Marco 2. (Desvio consciente da spec, que cita Crawlee: `got-scraping` é o cliente HTTP do Crawlee; a fila do Crawlee não encaixa em busca sob demanda.)
- Retentativas: 2 novas tentativas (`p-retry`, `retries: 2`). Tempo limite de busca por loja: 20 s.
- Coleta padrão `COLLECT_CRON="0 */3 * * *"`, fuso `America/Sao_Paulo`. Concorrência 1 por loja, atraso aleatório de 2–6 s entre requisições da mesma loja.
- Env: `APP_PASSWORD`, `NUXT_SESSION_PASSWORD` (≥ 32 caracteres), `DATABASE_PATH` (padrão `./data/app.db`), `COLLECT_CRON`, `COLLECT_ENABLED` (padrão `true`), `PROXY_URL_<LOJA>` opcional (ex.: `PROXY_URL_AMAZON`).
- Textos da UI em pt-BR.
- Commits: Conventional Commits, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Link colado com parâmetros de rastreio ou link curto** (`amzn.to`, `mercadolivre.com/sec/…`) → URL normalizada para a forma canônica; link curto recusado com a mensagem "Abra o link no navegador e cole a URL completa do produto". Testes nas Tasks 4–6 (`normalizeUrl`) e Task 3 (`findAdapterByUrl`).
2. **Mesmo anúncio adicionado duas vezes ao produto** → erro 409 "Esse anúncio já está neste produto", sem quebrar nada. Teste na Task 9.
3. **Produto recém-adicionado, ainda sem coleta** → resumo com `best = null`, `state = 'pending'`; card mostra "Aguardando coleta". Teste na Task 8.
4. **Esgotado em todas as lojas** → `best = null`, `state = 'soldout'`; card mostra "Esgotado em todas as lojas". Teste na Task 8.
5. **Loja devolve página de captcha/bloqueio com HTTP 200** → parser lança `BlockedError`, anúncio fica `error` com "Bloqueado pela loja", nenhum snapshot falso gravado. Testes nas Tasks 6 (fixture de captcha da Amazon) e 7.

---

### Task 1: Scaffold do projeto + utilitário de preço BRL

**Files:**
- Create: `package.json`, `nuxt.config.ts`, `tsconfig.json`, `vitest.config.ts`, `app/app.vue`, `app/assets/css/main.css`, `.gitignore`, `.env.example`, `.nvmrc`
- Create: `server/lib/money.ts`
- Test: `tests/unit/money.test.ts`

**Interfaces:**
- Produces: `parseBRL(text: string): number | null` (centavos), `formatBRL(cents: number): string`.

- [ ] **Step 1: Criar o app** com `pnpm dlx nuxi@latest init . --template ui` (Nuxt 4 + Nuxt UI), `.nvmrc` = `24`. Adicionar dev deps `vitest`, `@nuxt/test-utils`, `@vue/test-utils`, `happy-dom`. `vitest.config.ts` com `environment: 'node'` e `include: ['tests/**/*.test.ts']`. Scripts: `dev`, `build`, `test` (`vitest run`), `typecheck` (`nuxi typecheck`). `.gitignore` inclui `data/`, `.env`. `.env.example` lista todas as variáveis da seção Global Constraints com valores de exemplo.

- [ ] **Step 2: Escrever o teste que falha**

```ts
// tests/unit/money.test.ts
import { describe, it, expect } from 'vitest'
import { parseBRL, formatBRL } from '../../server/lib/money'

describe('parseBRL', () => {
  it.each([
    ['R$ 1.299,90', 129990],
    ['R$1.299', 129900],
    ['1.299,9', 129990],
    ['R$ 89,00', 8900],
    [' R$ 2.499,00 ', 249900],
    ['12x de R$ 108,33', 10833],   // pega o valor monetário, ignora "12x"
  ])('%s -> %i', (input, expected) => expect(parseBRL(input)).toBe(expected))

  it.each(['', 'Indisponível', 'R$ ', 'R$ 0,00'])('%s -> null', (input) =>
    expect(parseBRL(input)).toBeNull())
})

describe('formatBRL', () => {
  it('formata em pt-BR', () => expect(formatBRL(129990)).toBe('R$ 1.299,90'))
})
```

- [ ] **Step 3: Rodar** `pnpm test tests/unit/money.test.ts` → FAIL (módulo não existe).

- [ ] **Step 4: Implementar** `server/lib/money.ts`. `parseBRL`: extrai o primeiro número no formato `\d{1,3}(\.\d{3})*(,\d{1,2})?` que venha após `R$` se houver `R$`, senão o primeiro número; zero → `null`. `formatBRL` usa `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.

- [ ] **Step 5: Rodar** `pnpm test` → PASS; `pnpm dev` sobe em `localhost:3000` sem erro.

- [ ] **Step 6: Commit** `chore: scaffold nuxt app with BRL price utils`

---

### Task 2: Banco de dados (schema, cliente, migrações)

**Files:**
- Create: `server/db/schema.ts`, `server/db/client.ts`, `drizzle.config.ts`, `server/db/migrations/` (gerado)
- Create: `server/utils/db.ts` (singleton para rotas)
- Test: `tests/unit/db.test.ts`, `tests/helpers/db.ts`

**Interfaces:**
- Produces:
  - Tabelas `products`, `listings`, `priceSnapshots`, `alertsSent` exatamente com as colunas da spec §4 (camelCase no TS, snake_case no SQL). `listings`: índice único (`product_id`, `url`). `price_snapshots`: índice (`listing_id`, `captured_at`). FKs com `onDelete: 'cascade'`. Timestamps `integer({ mode: 'timestamp_ms' })`. `status` padrão `'pending'`, `consecutiveFailures` padrão `0`, `archived` padrão `false`, `targetMode` padrão `'cash'`.
  - Tipos exportados: `Product`, `Listing`, `PriceSnapshot` (`$inferSelect`), `PriceMode = 'cash' | 'installment'`, `ListingStatus`.
  - `createDb(path: string): Db` — abre better-sqlite3, `journal_mode = WAL`, `busy_timeout = 5000`, `foreign_keys = ON`, roda migrações de `MIGRATIONS_DIR` (padrão `server/db/migrations`, resolvido a partir de `process.cwd()`), devolve a instância Drizzle. `type Db`.
  - `useDb(): Db` em `server/utils/db.ts` — singleton com `DATABASE_PATH`; cria a pasta se não existir.
  - Helper de teste `testDb(): Db` = `createDb(':memory:')`.

- [ ] **Step 1: Teste que falha** — `tests/unit/db.test.ts`:
  - `it('cria produto, anúncio e snapshot e lê de volta')`: insere produto `{ name: 'TV 55' }`, listing `{ store: 'kabum', url: 'https://www.kabum.com.br/produto/1', title: 'TV' }`, snapshot `{ cashPriceCents: 249900, installmentPriceCents: 279900, installmentCount: 10, available: true, freeShipping: false }`; espera `listing.status === 'pending'` e snapshot lido com os mesmos valores.
  - `it('rejeita URL duplicada no mesmo produto')`: segundo insert da mesma URL lança erro com `UNIQUE`.
  - `it('apaga em cascata')`: apagar o produto remove listings e snapshots.
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar** schema + `drizzle.config.ts` (`dialect: 'sqlite'`, `out: 'server/db/migrations'`) e gerar a migração com `pnpm drizzle-kit generate` (script `db:generate`). Implementar `createDb` e `useDb`.
- [ ] **Step 4: Rodar** `pnpm test` → PASS.
- [ ] **Step 5: Commit** `feat(db): add drizzle schema, sqlite client and migrations`

---

### Task 3: Núcleo dos adaptadores (tipos, fetch HTTP, validação, registro)

**Files:**
- Create: `server/stores/types.ts`, `server/stores/errors.ts`, `server/stores/http.ts`, `server/stores/validate.ts`, `server/stores/registry.ts`
- Create: `scripts/capture-fixture.ts`
- Test: `tests/unit/validate.test.ts`, `tests/unit/registry.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type StoreId = 'mercadolivre' | 'kabum' | 'amazon'
  interface SearchResult { store: StoreId; url: string; title: string; imageUrl?: string; cashPriceCents?: number }
  interface PriceSnapshotInput { cashPriceCents: number | null; installmentPriceCents: number | null; installmentCount: number | null; available: boolean; freeShipping: boolean }
  interface ListingPage extends PriceSnapshotInput { title: string; imageUrl?: string }
  interface StoreAdapter {
    id: StoreId; name: string
    matches(url: string): boolean
    normalizeUrl(url: string): string          // lança ShortLinkError p/ link curto
    search(term: string, signal?: AbortSignal): Promise<SearchResult[]>
    fetchListing(url: string): Promise<ListingPage>
  }
  ```
  - `errors.ts`: `class BlockedError extends Error` (mensagem padrão "Bloqueado pela loja"), `class ShortLinkError extends Error` (mensagem: "Abra o link no navegador e cole a URL completa do produto"), `class UnsupportedStoreError extends Error` ("Loja não suportada").
  - `fetchHtml(store: StoreId, url: string, opts?: { signal?: AbortSignal }): Promise<string>` — `got-scraping` com headers de navegador e `accept-language: pt-BR`, `proxyUrl` de `PROXY_URL_<STORE maiúsculo>` se definido, timeout 20 s; status 403/429/503 → `BlockedError`. `fetchJson<T>` análogo.
  - `snapshotSchema` (zod) + `validateSnapshot(input: unknown): PriceSnapshotInput` — preços inteiros > 0 ou `null`; `installmentCount` inteiro 1–48 ou `null`; se `available` é `true`, pelo menos um preço não nulo.
  - `registry.ts`: `adapters: StoreAdapter[]`, `getAdapter(id: StoreId): StoreAdapter`, `findAdapterByUrl(url: string): StoreAdapter` (lança `UnsupportedStoreError`; URL inválida também). Começa com lista vazia; Tasks 4–6 registram.
  - `scripts/capture-fixture.ts <store> <name> <url>`: baixa via `fetchHtml` e grava `tests/fixtures/<store>/<name>.html`. Script `capture` no package.json (rodar com `tsx`).

- [ ] **Step 1: Testes que falham**
  - `validate.test.ts`: aceita snapshot válido; aceita `available: false` com preços nulos; rejeita `available: true` com os dois preços nulos; rejeita preço `0`, `-1`, `12.5`; rejeita `installmentCount: 0` e `60`.
  - `registry.test.ts`: com um adaptador falso registrado (`matches` = host `loja.test`), `findAdapterByUrl('https://loja.test/p/1')` devolve ele; `'https://outra.com/x'` lança `UnsupportedStoreError`; `'não é url'` lança `UnsupportedStoreError`. Expor `registerAdapter(a)` / `resetAdapters()` só para teste.
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar** os arquivos acima.
- [ ] **Step 4: Rodar** `pnpm test` → PASS.
- [ ] **Step 5: Commit** `feat(stores): add adapter contract, http fetcher and snapshot validation`

---

### Tasks 4–6: padrão comum dos adaptadores

Cada adaptador fica em `server/stores/<loja>/` com três arquivos:
- `parse.ts` — funções **puras**: `parseSearch(html: string): SearchResult[]` e `parseListing(html: string): ListingPage`. Lançam `BlockedError` se a página for captcha/bloqueio.
- `url.ts` — `matches(url)` e `normalizeUrl(url)`.
- `index.ts` — o `StoreAdapter` (monta URL de busca, chama `fetchHtml`, chama os parsers) e se registra em `registry.ts`.

Fixtures reais em `tests/fixtures/<loja>/`, capturadas com `pnpm capture`: `search.html` (busca por "smart tv 55"), `product.html` (produto disponível, de preferência com preço à vista diferente do a prazo), `soldout.html` (produto esgotado, se encontrar). Os valores esperados nos testes são os que **aparecem na fixture salva** (abra o HTML e anote título, preço à vista, a prazo, parcelas).

Teste de cada loja (`tests/unit/stores/<loja>.test.ts`):
- `parseSearch(search.html)`: ≥ 5 resultados; todos com `store` correto, `url` absoluta e já normalizada, `title` não vazio; o primeiro resultado tem título e preço iguais aos anotados.
- `parseListing(product.html)`: título, `cashPriceCents`, `installmentPriceCents`, `installmentCount`, `available: true` e `freeShipping` iguais aos anotados; o resultado passa em `validateSnapshot`.
- `parseListing(soldout.html)` (se houver): `available: false`.
- `matches`/`normalizeUrl`: casos de URL listados na task.
- `parseListing('<html>…</html>')` sem dados de produto → lança erro (não devolve preços nulos com `available: true`).

Commit de cada um: `feat(stores): add <loja> adapter`.

### Task 4: Adaptador Mercado Livre

**Files:** `server/stores/mercadolivre/{parse,url,index}.ts`, `tests/fixtures/mercadolivre/*.html`, `tests/unit/stores/mercadolivre.test.ts`

**Interfaces:** Consumes Task 3. Produces adapter `id: 'mercadolivre'`, `name: 'Mercado Livre'`.

- Busca: `https://lista.mercadolivre.com.br/<termo com espaços → hífens>`. Produto: preço via JSON-LD `Product.offers.price` como fonte primária para o à vista; parcelas e total a prazo pelo texto "em Nx R$ Y" (total = N × Y, ou o total exibido se houver).
- `matches`: host termina em `mercadolivre.com.br`.
- `normalizeUrl`: remove query e hash; mantém `produto.mercadolivre.com.br/MLB-…` e `www.mercadolivre.com.br/…/p/MLB…`. `mercadolivre.com/sec/…` → `ShortLinkError`.
- Casos de URL no teste: com `?searchVariation=…#reco` → sem query/hash; link `/sec/` → `ShortLinkError`.

- [ ] **Step 1:** Capturar fixtures.
- [ ] **Step 2:** Escrever testes (padrão acima) → rodar → FAIL.
- [ ] **Step 3:** Implementar `url.ts`, `parse.ts`, `index.ts` e registrar.
- [ ] **Step 4:** `pnpm test` → PASS.
- [ ] **Step 5:** Commit.

### Task 5: Adaptador KaBuM

**Files:** `server/stores/kabum/{parse,url,index}.ts`, `tests/fixtures/kabum/*.html`, `tests/unit/stores/kabum.test.ts`

**Interfaces:** Produces adapter `id: 'kabum'`, `name: 'KaBuM!'`.

- Busca: `https://www.kabum.com.br/busca/<termo com espaços → hífens>`. As páginas trazem o JSON `<script id="__NEXT_DATA__">`; extrair dele (campos do tipo `priceWithDiscount` = à vista/Pix, `price` = a prazo, `maxInstallment`/parcelas, `available`). Confirmar os caminhos na fixture.
- `matches`: host `kabum.com.br` ou `www.kabum.com.br`. `normalizeUrl`: `https://www.kabum.com.br/produto/<id>` (descarta slug, query e hash).
- Casos de URL: `https://www.kabum.com.br/produto/123456/tv-55?utm_source=x` → `https://www.kabum.com.br/produto/123456`.

- [ ] **Step 1–5:** como na Task 4.

### Task 6: Adaptador Amazon

**Files:** `server/stores/amazon/{parse,url,index}.ts`, `tests/fixtures/amazon/*.html` (+ `captcha.html`), `tests/unit/stores/amazon.test.ts`

**Interfaces:** Produces adapter `id: 'amazon'`, `name: 'Amazon'`.

- Busca: `https://www.amazon.com.br/s?k=<termo>`; resultados em `[data-component-type="s-search-result"]` com `data-asin`; ignorar patrocinados sem ASIN. Produto: preço principal em `#corePrice_feature_div .a-offscreen` (à vista); parcelas pelo texto "em até Nx de R$ Y" (total = N × Y). Sem bloco de preço e com "Não disponível" → `available: false`.
- Página com formulário `/errors/validateCaptcha` ou texto "Digite os caracteres" → `BlockedError` (vale para busca e produto).
- `matches`: host `amazon.com.br` / `www.amazon.com.br`. `normalizeUrl`: `https://www.amazon.com.br/dp/<ASIN>` a partir de `/dp/<ASIN>`, `/gp/product/<ASIN>` ou `/<slug>/dp/<ASIN>/ref=…`. `amzn.to` / `a.co` → `ShortLinkError`.
- Casos de URL: `/Smart-TV/dp/B0C1234567/ref=sr_1_3?keywords=tv` → `https://www.amazon.com.br/dp/B0C1234567`; `/gp/product/B0C1234567` → idem; `https://amzn.to/3xyz` → `ShortLinkError`.
- Teste extra: `parseListing(captcha.html)` e `parseSearch(captcha.html)` lançam `BlockedError`. Se não conseguir capturar um captcha real, criar `captcha.html` mínimo com `<form action="/errors/validateCaptcha">`.

- [ ] **Step 1–5:** como na Task 4.

---

### Task 7: Coletor (coleta de anúncio, ciclo, agendador, backup)

**Files:**
- Create: `server/collector/collect.ts`, `server/collector/cycle.ts`, `server/collector/backup.ts`, `server/plugins/scheduler.ts`
- Test: `tests/unit/collector.test.ts`, `tests/unit/backup.test.ts`

**Interfaces:**
- Consumes: `Db`, tabelas (Task 2); `getAdapter`, `validateSnapshot`, `BlockedError` (Task 3).
- Produces:
  - `collectListing(db: Db, listingId: number, deps?: { getAdapter?: typeof getAdapter }): Promise<{ listingId: number; ok: boolean; error?: string }>` — chama `fetchListing` com `p-retry` (`retries: 2`, sem retentar `BlockedError`), valida, grava snapshot, atualiza `status` (`ok` ou `unavailable`), `lastError = null`, `consecutiveFailures = 0`, `lastCheckedAt`. Em falha: `status = 'error'`, `lastError` (máx. 500 caracteres), `consecutiveFailures + 1`, `lastCheckedAt`, **nenhum snapshot**. Nunca lança.
  - `collectProduct(db: Db, productId: number): Promise<CollectResult[]>` — todos os anúncios do produto, em paralelo.
  - `runCycle(db: Db, deps?: { sleep?: (ms: number) => Promise<void>; random?: () => number; getAdapter?: … }): Promise<{ skipped: boolean; results: CollectResult[] }>` — anúncios de produtos não arquivados, agrupados por loja; lojas em paralelo, dentro da loja em sequência com `sleep(2000 + random() * 4000)` entre itens; se um ciclo já está rodando, devolve `{ skipped: true, results: [] }`.
  - `backupDb(db: Db, dir: string, now?: Date): Promise<string>` — `VACUUM INTO '<dir>/app-YYYY-MM-DD.db'`, apaga backups além dos 7 mais recentes, devolve o caminho.
  - Plugin `scheduler.ts`: se `COLLECT_ENABLED !== 'false'`, `new Cron(COLLECT_CRON, { timezone: 'America/Sao_Paulo', protect: true }, () => runCycle(useDb()))` e um `Cron('0 4 * * *', …)` para `backupDb` em `<pasta do DATABASE_PATH>/backups`. Loga início/fim do ciclo com contagem de ok/erro.

- [ ] **Step 1: Testes que falham** (`collector.test.ts`, com `testDb()` e adaptador falso injetado):
  - `it('grava snapshot e marca ok')`.
  - `it('produto esgotado grava snapshot com available=false e status unavailable')`.
  - `it('erro: status error, consecutiveFailures incrementa, sem snapshot')` — duas falhas seguidas → `consecutiveFailures === 2`; um sucesso depois → `0`.
  - `it('tenta de novo 2 vezes antes de desistir')` — adaptador que falha 2× e acerta na 3ª → `ok: true`, 3 chamadas.
  - `it('BlockedError não é retentado e grava "Bloqueado pela loja"')` — 1 chamada, `lastError` contém "Bloqueado".
  - `it('snapshot inválido conta como erro')` — `available: true` com preços nulos → `error`, sem snapshot.
  - `it('runCycle ignora produtos arquivados')`.
  - `it('runCycle concorrente devolve skipped')` — chamar duas vezes sem aguardar; a segunda devolve `skipped: true`.
  - `it('runCycle espera entre itens da mesma loja')` — `sleep` falso registra chamadas: 3 anúncios da mesma loja → 2 chamadas com valores entre 2000 e 6000.
  - `backup.test.ts`: banco em arquivo temporário; 9 backups com datas diferentes → restam 7, o arquivo novo existe.
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar** os módulos e o plugin.
- [ ] **Step 4: Rodar** `pnpm test` → PASS.
- [ ] **Step 5: Commit** `feat(collector): add listing collection, scheduled cycle and daily backup`

---

### Task 8: Consultas de preço (resumo, detalhe, histórico)

**Files:**
- Create: `server/services/prices.ts`
- Test: `tests/unit/prices.test.ts`

**Interfaces:**
- Consumes: `Db`, `PriceMode` (Task 2).
- Produces:
  ```ts
  interface StorePrice { listingId: number; store: StoreId; title: string; url: string; status: ListingStatus;
    cashPriceCents: number | null; installmentPriceCents: number | null; installmentCount: number | null;
    available: boolean; freeShipping: boolean; capturedAt: Date | null; lastError: string | null }
  interface ProductSummary { id: number; name: string; imageUrl: string | null;
    state: 'pending' | 'soldout' | 'ok'; best: StorePrice | null;
    change7dPercent: number | null; onTarget: boolean; hasError: boolean }
  function pickBest(prices: StorePrice[], mode: PriceMode): StorePrice | null
  function listSummaries(db: Db, mode: PriceMode, now?: Date): ProductSummary[]
  function getProductDetail(db: Db, id: number, mode: PriceMode, now?: Date):
    (ProductSummary & { product: Product; stores: StorePrice[]; lowestEver: { cents: number; store: StoreId; at: Date } | null; price7dAgo: number | null }) | null
  function getHistory(db: Db, productId: number, range: '7d' | '30d' | 'all', now?: Date):
    { listingId: number; store: StoreId; title: string; points: { t: Date; cash: number | null; installment: number | null; available: boolean }[] }[]
  ```
  - `StorePrice` usa o **último** snapshot de cada anúncio. `stores` ordenado por preço no `mode` (indisponíveis e sem preço no fim).
  - `pickBest`: só `available` com preço não nulo no `mode`; menor preço; empate → o mais recente.
  - `state`: `pending` se nenhum anúncio tem snapshot; `soldout` se tem snapshots mas `pickBest` é `null`; senão `ok`.
  - `change7dPercent`: compara o melhor preço atual com o melhor preço considerando, para cada anúncio, o último snapshot com `capturedAt <= now − 7 dias`; `null` se não houver dado de 7 dias atrás. Arredondar para 1 casa.
  - `onTarget`: `targetPriceCents` definido e o melhor preço no `targetMode` do produto (não no `mode` da tela) ≤ alvo.
  - `hasError`: algum anúncio com `status === 'error'`.
  - `lowestEver`: menor preço disponível no `mode` entre todos os snapshots do produto.
  - `listSummaries` exclui arquivados.

- [ ] **Step 1: Testes que falham** (dados montados direto no `testDb()`, `now` fixo `2026-11-20T12:00:00Z`):
  - `pickBest`: escolhe o menor à vista; no modo `installment` escolhe outro anúncio quando o a prazo dele é menor; ignora indisponível; ignora preço nulo no modo; devolve `null` para lista vazia.
  - `it('produto sem coleta → pending, best null')` (Review Focus 3).
  - `it('esgotado em todas as lojas → soldout, best null')` (Review Focus 4).
  - `it('change7dPercent')`: há 8 dias R$ 1.000,00, hoje R$ 900,00 → `-10`; sem dado anterior a 7 dias → `null`.
  - `it('onTarget usa o targetMode do produto')`: alvo 95000 em `installment`, a prazo 94000 e à vista 90000 → `true` mesmo com `mode = 'cash'`; alvo 89000 → `false`.
  - `it('hasError quando um anúncio está com erro')`.
  - `it('getHistory filtra pelo período')`: snapshots de 40, 20 e 1 dia atrás → `7d` = 1 ponto, `30d` = 2, `all` = 3; um item por anúncio, pontos em ordem crescente de `t`.
  - `it('lowestEver pega o menor histórico disponível')`.
  - `it('listSummaries não inclui arquivados')`.
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar** `server/services/prices.ts` (consultas Drizzle; agregações simples podem ser feitas em TS sobre os snapshots do produto, o volume é pequeno).
- [ ] **Step 4: Rodar** → PASS.
- [ ] **Step 5: Commit** `feat(prices): add best price, summaries and history queries`

---

### Task 9: Serviço de produtos + rotas da API

**Files:**
- Create: `server/services/products.ts`
- Create: `server/api/stores.get.ts`, `server/api/search/[store].get.ts`, `server/api/resolve-link.post.ts`, `server/api/products/index.get.ts`, `server/api/products/index.post.ts`, `server/api/products/[id]/index.get.ts`, `server/api/products/[id]/index.patch.ts`, `server/api/products/[id]/history.get.ts`, `server/api/products/[id]/collect.post.ts`, `server/api/products/[id]/listings.post.ts`, `server/api/listings/[id].delete.ts`
- Test: `tests/unit/products.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 3, 7, 8.
- Produces (serviço, todos recebem `db`):
  - `class DuplicateListingError extends Error` (mensagem "Esse anúncio já está neste produto").
  - `newListingSchema` = `{ store: StoreId, url: string(url), title: string min 1, imageUrl?: string }`.
  - `createProductSchema` = `{ name: string 1–200, imageUrl?: string, targetPriceCents?: int > 0, targetMode: 'cash'|'installment' (padrão 'cash'), dropAlertPercent?: int 1–90, listings: newListing[] min 1 }`.
  - `updateProductSchema` = parcial de `{ name, targetPriceCents (nullable), targetMode, dropAlertPercent (nullable), archived }`.
  - `createProduct(db, input): Product` — normaliza cada URL com `getAdapter(store).normalizeUrl`; URLs repetidas na mesma entrada → `DuplicateListingError`. Transação.
  - `updateProduct(db, id, patch): Product | null`.
  - `addListing(db, productId, input): Listing` — URL normalizada; já existente → `DuplicateListingError`.
  - `removeListing(db, listingId): boolean`.
- Rotas (finas: validam com `getValidatedQuery` / `readValidatedBody` + zod, chamam serviço, mapeiam erros):
  - `GET /api/stores` → `[{ id, name }]`.
  - `GET /api/search/:store?q=` (q 2–100 chars) → `{ results: SearchResult[] }`; usa `AbortSignal.timeout(20000)`; `BlockedError` → 502 com a mensagem; timeout → 504 "A loja não respondeu".
  - `POST /api/resolve-link { url }` → `findAdapterByUrl` → `normalizeUrl` → `fetchListing` → `{ store, url, title, imageUrl, cashPriceCents }`. `ShortLinkError`/`UnsupportedStoreError` → 400 com a mensagem.
  - `GET /api/products?mode=cash|installment` → `ProductSummary[]`.
  - `POST /api/products` → cria e dispara `collectProduct` **sem aguardar** (erros só logados); responde 201 com o produto.
  - `GET /api/products/:id?mode=` → `getProductDetail` (404 se `null`).
  - `PATCH /api/products/:id` → `updateProduct`.
  - `GET /api/products/:id/history?range=7d|30d|all` → `getHistory`.
  - `POST /api/products/:id/collect` → aguarda `collectProduct`, devolve resultados.
  - `POST /api/products/:id/listings` → `addListing` + `collectListing` sem aguardar.
  - `DELETE /api/listings/:id` → 204 / 404.
  - `DuplicateListingError` → 409 com a mensagem; erro de validação zod → 400.

- [ ] **Step 1: Testes que falham** (`products.test.ts`, serviço com `testDb()` e adaptadores reais só para `normalizeUrl`):
  - `it('createProduct normaliza URLs')` — URL Amazon com `ref=` vira `/dp/ASIN`.
  - `it('createProduct recusa a mesma URL duas vezes')` — duas URLs KaBuM que normalizam igual → `DuplicateListingError` e nenhum produto criado (Review Focus 2).
  - `it('addListing recusa anúncio já existente')` → `DuplicateListingError` (Review Focus 2).
  - `it('createProductSchema recusa lista de anúncios vazia e alvo 0')`.
  - `it('updateProduct limpa o alvo com null e arquiva')`.
  - `it('removeListing devolve false para id inexistente')`.
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar** serviço e rotas.
- [ ] **Step 4: Rodar** `pnpm test` → PASS; com `pnpm dev`, `curl "localhost:3000/api/search/kabum?q=smart%20tv"` devolve resultados (a autenticação entra na Task 10).
- [ ] **Step 5: Commit** `feat(api): add product service and REST routes`

---

### Task 10: Acesso com senha única

**Files:**
- Create: `server/api/auth/login.post.ts`, `server/api/auth/logout.post.ts`, `server/middleware/auth.ts`, `server/lib/password.ts`, `app/pages/login.vue`, `app/middleware/auth.global.ts`
- Modify: `nuxt.config.ts` (módulo `nuxt-auth-utils`)
- Test: `tests/unit/password.test.ts`, `tests/e2e/auth.test.ts`

**Interfaces:**
- Produces: `checkPassword(given: string, expected: string): boolean` (comparação de tempo constante com `crypto.timingSafeEqual` sobre hashes SHA-256; `expected` vazio → sempre `false`).
  - `POST /api/auth/login { password }` → ok: `setUserSession(event, { user: { name: 'owner' } })` e 204; errada → 401 "Senha incorreta" (com atraso fixo de 500 ms).
  - Middleware do servidor: toda rota `/api/**` exceto `/api/auth/login` exige `requireUserSession`.
  - Middleware global do app: sem sessão (`useUserSession().loggedIn`) → redireciona para `/login`; logado em `/login` → `/`.
  - `login.vue`: campo de senha + botão "Entrar", mostra o erro da API.

- [ ] **Step 1: Testes que falham**
  - `password.test.ts`: certa → `true`; errada → `false`; tamanhos diferentes → `false` sem lançar; `expected = ''` → `false`.
  - `tests/e2e/auth.test.ts` com `@nuxt/test-utils/e2e` (`setup({ server: true, env: { APP_PASSWORD: 'teste123', NUXT_SESSION_PASSWORD: '<32+ chars>', DATABASE_PATH: ':memory:', COLLECT_ENABLED: 'false' } })`): `GET /api/products` sem sessão → 401; `POST /api/auth/login` com senha errada → 401; com a certa → 204 e o cookie permite `GET /api/products` → 200.
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** `pnpm test` → PASS.
- [ ] **Step 5: Commit** `feat(auth): protect app with single password`

---

### Task 11: Layout, seletor de modo e tela "Minha lista"

**Files:**
- Create: `app/composables/usePriceMode.ts`, `app/layouts/default.vue`, `app/components/PriceModeToggle.vue`, `app/components/ProductCard.vue`, `app/pages/index.vue`, `app/utils/format.ts`
- Test: `tests/unit/usePriceMode.test.ts`

**Interfaces:**
- Consumes: `GET /api/products?mode=` → `ProductSummary[]`; `formatBRL` (reexportado em `app/utils/format.ts` junto com `formatDateTime(d)` em `America/Sao_Paulo`).
- Produces: `usePriceMode(): Ref<PriceMode>` — estado compartilhado (`useState`), lido/gravado em `localStorage` chave `bfm.priceMode` dentro de `try/catch`, padrão `'cash'`. Funções puras no mesmo arquivo: `readStoredMode(storage: Pick<Storage, 'getItem'> | undefined): PriceMode` e `storeMode(storage: Pick<Storage, 'setItem'> | undefined, mode: PriceMode): void`.

- [ ] **Step 1: Teste que falha** — `usePriceMode.test.ts` (ambiente `happy-dom`, testando a função de leitura/gravação isolada `readStoredMode(storage)` / `storeMode(storage, mode)`): valor salvo `'installment'` é lido; valor inválido → `'cash'`; storage que lança → `'cash'` sem erro.
- [ ] **Step 2: Rodar** → FAIL.
- [ ] **Step 3: Implementar**:
  - Layout: cabeçalho com nome "Monitor BF", `PriceModeToggle` (À vista / A prazo) e botão "Sair".
  - `index.vue`: `useFetch('/api/products', { query: { mode } })` reagindo ao modo; grade de `ProductCard`; vazio → "Sua lista está vazia" + botão "+ Adicionar produto" (sempre visível no topo também).
  - `ProductCard`: foto, nome, melhor preço + loja; `state === 'pending'` → "Aguardando coleta"; `'soldout'` → "Esgotado em todas as lojas"; `change7dPercent` com ▼ verde / ▲ vermelho; selo "No alvo" se `onTarget`; ícone de aviso se `hasError`; clique leva a `/produto/:id`.
- [ ] **Step 4: Rodar** `pnpm test` → PASS; verificar no navegador: login → lista vazia → seletor troca e continua após recarregar.
- [ ] **Step 5: Commit** `feat(ui): add layout, price mode toggle and product list`

---

### Task 12: Tela "Adicionar produto"

**Files:**
- Create: `app/pages/adicionar.vue`, `app/components/StoreSearchGroup.vue`, `app/components/PasteLinkField.vue`, `app/components/ProductAlertFields.vue`

**Interfaces:**
- Consumes: `GET /api/stores`, `GET /api/search/:store?q=`, `POST /api/resolve-link`, `POST /api/products`.
- Produces: `ProductAlertFields` (v-model `{ targetPriceCents, targetMode, dropAlertPercent }`, entrada de preço em reais convertida para centavos) — reutilizado na Task 13.

- [ ] **Step 1: Implementar**:
  - Campo de busca + "Buscar": dispara uma requisição por loja **em paralelo**; cada `StoreSearchGroup` mostra carregando → resultados (foto, título, preço, link "ver na loja", checkbox) → ou "Não respondeu" / mensagem de erro da API.
  - `PasteLinkField`: cola URL → `resolve-link` → adiciona aos selecionados; mostra a mensagem de erro da API (link curto, loja não suportada).
  - Painel "Selecionados" com remover; nome preenchido com o título do primeiro selecionado (editável); `ProductAlertFields`.
  - "Salvar" desabilitado sem nome ou sem anúncio; em sucesso navega para `/produto/:id`; 409 mostra a mensagem.
- [ ] **Step 2: Verificar no navegador**: buscar "smart tv 55" → grupos das 3 lojas carregam independentes; marcar 2 anúncios + colar 1 link da Amazon → salvar → abre o detalhe. Colar `https://amzn.to/abc` → mensagem de link curto.
- [ ] **Step 3: Commit** `feat(ui): add product search and add page`

---

### Task 13: Tela de detalhe com histórico

**Files:**
- Create: `app/pages/produto/[id].vue`, `app/components/StorePriceTable.vue`, `app/components/PriceHistoryChart.vue`, `app/components/ListingManager.vue`
- Modify: `nuxt.config.ts` (`vue-echarts` no build/transpile conforme a doc)

**Interfaces:**
- Consumes: `GET /api/products/:id?mode=`, `GET /api/products/:id/history?range=`, `PATCH /api/products/:id`, `POST /api/products/:id/collect`, `POST /api/products/:id/listings`, `DELETE /api/listings/:id`, `ProductAlertFields` (Task 12), `StoreSearchGroup`/`PasteLinkField` (Task 12).

- [ ] **Step 1: Implementar**:
  - Topo: nome, melhor preço no modo atual + loja + botão "Ir para a loja" (nova aba); estados pending/soldout como no card; "Menor preço já visto: R$ X (loja, data)"; "Há 7 dias: R$ Y".
  - `StorePriceTable`: uma linha por anúncio na ordem de `stores` — loja, à vista, a prazo ("10x de R$ …" + total), disponível, selo "Frete grátis", "checado há …", erro em vermelho com `lastError`.
  - `PriceHistoryChart` (ECharts, só no cliente com `<ClientOnly>`): eixo de tempo, uma linha por loja usando `cash` ou `installment` conforme o modo, pontos indisponíveis como lacuna (`null`), linha tracejada do alvo quando `targetMode` = modo atual; abas 7 dias / 30 dias / Tudo (padrão 30 dias); tooltip em BRL.
  - Editar alerta (`ProductAlertFields` + salvar via PATCH); "Coletar agora" (botão com carregando, recarrega dados ao fim); `ListingManager` (remover anúncio com confirmação; adicionar por busca ou link); "Arquivar" com confirmação → volta para `/`.
  - Enquanto houver anúncio `pending`, recarregar o detalhe a cada 5 s (parar quando não houver).
- [ ] **Step 2: Verificar no navegador**: produto criado na Task 12 mostra tabela e gráfico; "Coletar agora" adiciona ponto; trocar o modo muda melhor preço e linhas; arquivar remove da lista.
- [ ] **Step 3: Commit** `feat(ui): add product detail with price history chart`

---

### Task 14: Verificação ao vivo, Docker e deploy

**Files:**
- Create: `scripts/check-stores.ts`, `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `Caddyfile`, `README.md`

**Interfaces:**
- Consumes: registry (Task 3), `createDb`/migrações (Task 2).

- [ ] **Step 1: `pnpm check:stores`** (`tsx scripts/check-stores.ts [termo]`, padrão "smart tv 55"): para cada adaptador, busca o termo, faz `fetchListing` do primeiro resultado e imprime uma linha `✔ Amazon — 24 resultados — R$ 2.499,00 à vista / 10x R$ 279,90` ou `✘ Amazon — Bloqueado pela loja`. Código de saída 1 se alguma loja falhar.
- [ ] **Step 2: Rodar** `pnpm check:stores` localmente → as 3 lojas com ✔ (anotar no README qualquer loja que falhe).
- [ ] **Step 3: Docker**:
  - `Dockerfile` multi-stage com `node:24-slim`: instala com `pnpm install --frozen-lockfile`, `pnpm build`; imagem final copia `.output/` e `server/db/migrations/`, define `MIGRATIONS_DIR=/app/server/db/migrations`, `DATABASE_PATH=/data/app.db`, `NODE_ENV=production`, roda `node .output/server/index.mjs` como usuário não root. (better-sqlite3 precisa de binário nativo: garantir que o pacote seja instalado/compilado no estágio de build com a mesma base.)
  - `docker-compose.yml`: serviço `app` (volume `data:/data`, `env_file: .env`, `restart: unless-stopped`, sem porta pública) e `caddy` (`caddy:2`, portas 80/443, volume de certificados) com `Caddyfile` `{$DOMAIN} { reverse_proxy app:3000 }`.
- [ ] **Step 4: Verificar** `docker compose up --build` local com `DOMAIN=localhost` → login funciona em `https://localhost`, banco criado em `/data`, log mostra o agendador registrado.
- [ ] **Step 5: README.md** em pt-BR: o que é; requisitos (VPS ≥ 2 GB RAM, Docker, um domínio ou subdomínio apontando para o VPS); variáveis de ambiente (copiar `.env.example`); `docker compose up -d`; como ver logs; onde ficam banco e backups; `pnpm check:stores`; como adicionar proxy por loja se for bloqueado.
- [ ] **Step 6: Commit** `chore: add store check script, docker and deploy docs`

Após esta task: o deploy no VPS real é feito com o usuário (escolha do provedor e do domínio), e a coleta começa a acumular histórico.
