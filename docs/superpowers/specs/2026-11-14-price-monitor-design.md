# Monitor de Preços — Black Friday (design)

Data: 2026-11-14 · Status: aguardando revisão

## 1. Objetivo

Ferramenta de **uso pessoal** para comprar bem na Black Friday (27/11/2026).
Permite pesquisar um produto nas principais lojas do varejo brasileiro,
adicioná-lo a uma lista, ver o **histórico de preço** por loja e saber **onde
está o melhor preço do dia**, com alertas no Telegram e no Discord.

### Critérios de sucesso

- Coleta rodando no servidor o quanto antes (meta: ~3 dias), para acumular
  histórico antes de 27/11 e permitir identificar "desconto falso" (preço
  que sobe antes da Black Friday).
- Para cada produto da lista: melhor preço de hoje (à vista ou a prazo,
  conforme seletor) e gráfico de histórico com uma linha por loja.
- Alerta no Telegram e no Discord quando o preço-alvo é atingido ou o preço
  cai X%.
- Uma loja quebrada/bloqueada não derruba as demais.

### Fora de escopo (v1)

- Múltiplos usuários, cadastro, contas.
- Cálculo de frete por CEP (só selo "frete grátis" quando a loja informar).
- Histórico anterior à data em que o produto foi adicionado.
- Junção automática de anúncios entre lojas (por EAN/similaridade).
- Cupons e cashback.

## 2. Decisões

| Tema | Decisão |
|---|---|
| Uso | Pessoal, servidor barato (VPS ≥ 2 GB RAM) |
| Lojas | Todas as viáveis, via adaptador por loja, em marcos |
| Junção de produto | Busca em todas as lojas + usuário marca os anúncios; alternativa: colar link |
| Preço | Guardar à vista **e** a prazo; seletor na UI define qual é comparado |
| Frete | Fora da v1; apenas flag `frete grátis` |
| Alertas | Telegram (bot) + Discord (webhook) |
| Stack | Nuxt 3 (TypeScript) monolito, um processo, um container |
| Banco | SQLite + Drizzle ORM |
| Coleta | Crawlee (HTTP ou Playwright, por loja) + agendador `croner` |
| UI | Nuxt UI + ECharts (`vue-echarts`) |
| Acesso | Senha única via env, sessão com `nuxt-auth-utils` |
| Testes | Vitest com fixtures de HTML/JSON reais |
| Deploy | Docker (imagem base do Playwright) + Caddy (HTTPS) |

Abordagens descartadas: backend Python separado (mais uma linguagem/serviço
para manter) e Supabase + GitHub Actions (IPs do Actions bloqueados pelas
lojas, Playwright lento, limites de minutos).

## 3. Arquitetura

Um app Nuxt 3; o agendador roda dentro do servidor Nitro (plugin).

```
black-friday-monitoring/
├─ app/                 páginas e componentes Vue
├─ server/
│  ├─ api/              rotas HTTP consumidas pela UI
│  ├─ stores/           um adaptador por loja + registro
│  ├─ collector/        agendador e ciclo de coleta
│  ├─ alerts/           regras de alerta + notifiers
│  ├─ db/               schema Drizzle, cliente SQLite, migrações
│  └─ plugins/          inicia o agendador
├─ tests/fixtures/      páginas reais salvas por loja
└─ Dockerfile, Caddyfile, docker-compose.yml
```

### 3.1 Adaptador de loja

Contrato comum (`server/stores/types.ts`):

```ts
interface StoreAdapter {
  id: StoreId                     // 'mercadolivre' | 'kabum' | 'amazon' | ...
  name: string
  matches(url: string): boolean   // reconhece link colado
  search(term: string): Promise<SearchResult[]>
  fetchListing(url: string): Promise<PriceSnapshotInput>
}

interface SearchResult {
  store: StoreId; url: string; title: string
  imageUrl?: string; cashPriceCents?: number
}

interface PriceSnapshotInput {
  cashPriceCents: number | null         // à vista / Pix
  installmentPriceCents: number | null  // total a prazo
  installmentCount: number | null
  available: boolean
  freeShipping: boolean
}
```

- Cada adaptador separa **busca de página** (HTTP ou Playwright) de **parse**
  (função pura que recebe HTML/JSON e devolve os dados), para o parse ser
  testável com fixtures.
- Lojas com API/JSON acessível (ex.: Mercado Livre) usam HTTP simples; lojas
  com anti-bot usam Playwright via Crawlee.
- O resultado passa por validação `zod` antes de ser gravado.
- Preparado para proxy opcional por loja (`PROXY_URL_<LOJA>` no env), para o
  caso de bloqueio de IP de datacenter.

### 3.2 Coleta

- `croner` dispara o ciclo a cada `COLLECT_CRON` (padrão: a cada 3 h;
  pode ir para 1 h na semana da Black Friday).
- O ciclo percorre todos os anúncios de produtos não arquivados, agrupados
  por loja, com concorrência baixa (1–2 por loja) e atraso aleatório entre
  requisições.
- Cada anúncio: até 2 novas tentativas; sucesso grava um snapshot e marca
  `status = ok|unavailable`; falha grava `status = error` + `lastError`.
- Ao fim do ciclo, roda as regras de alerta.
- Um ciclo não começa se o anterior ainda estiver rodando.
- "Coletar agora" (por produto) e a primeira coleta ao salvar um produto
  usam a mesma função, fora do agendador.

### 3.3 Busca na UI

- `GET /api/search/:store?q=` — uma chamada por loja, disparadas em
  paralelo pela UI; resultados aparecem conforme cada loja responde.
- Tempo limite de ~20 s por loja; falha retorna erro só daquela loja.
- `POST /api/resolve-link` — identifica a loja por `matches()` e devolve os
  dados do anúncio via `fetchListing`.

### 3.4 Alertas

- Interface `Notifier { send(message): Promise<void> }` com
  `TelegramNotifier` (bot token + chat id) e `DiscordNotifier` (webhook URL).
  Notifiers sem configuração no env ficam desativados.
- Regras, avaliadas sobre o modo de preço do alvo do produto:
  - **Alvo:** menor preço disponível atual ≤ preço-alvo.
  - **Queda:** menor preço atual ≤ (menor preço anterior registrado) × (1 − X%).
- Antispam (`alerts_sent`): repete um alerta do mesmo produto e tipo só se
  o preço ficou abaixo do último preço avisado, ou após 24 h.
- Queda > 70% em uma coleta: alerta enviado com marcação "⚠ verificar".
- Loja com 3 falhas seguidas: um único aviso de saúde; novo aviso só depois
  de a loja voltar a funcionar e falhar de novo.
- Mensagem: produto, loja, preço (à vista e a prazo), variação, link.

## 4. Dados (SQLite / Drizzle)

Preços em **centavos (inteiro)**. Datas em UTC; exibição em
America/Sao_Paulo.

**products**
- `id`, `name`, `imageUrl`, `createdAt`, `archived` (bool)
- `targetPriceCents` (nullable), `targetMode` (`cash` | `installment`)
- `dropAlertPercent` (nullable)

**listings**
- `id`, `productId` (FK), `store`, `url` (único por produto), `title`,
  `imageUrl`
- `status` (`pending` | `ok` | `unavailable` | `error`), `lastError`,
  `lastCheckedAt`, `consecutiveFailures`, `createdAt`

**price_snapshots**
- `id`, `listingId` (FK), `capturedAt`
- `cashPriceCents`, `installmentPriceCents`, `installmentCount`
- `available`, `freeShipping`
- índice em (`listingId`, `capturedAt`)

**alerts_sent**
- `id`, `productId`, `listingId`, `kind` (`target` | `drop` | `store_health`),
  `priceCents`, `sentAt`

Consultas principais:
- **Melhor preço hoje:** último snapshot de cada anúncio, apenas os
  disponíveis, menor valor no modo selecionado.
- **Histórico:** snapshots por anúncio no período (7 d / 30 d / tudo),
  série por loja; destaques "menor preço já visto" e "preço há 7 dias".

Backup: cópia diária do arquivo SQLite (`VACUUM INTO`) no volume, guardando
os últimos 7 dias.

## 5. Telas

Seletor global **À vista / A prazo** no topo (lembrado via `localStorage`,
com padrão "à vista" se indisponível).

1. **Minha lista (`/`)** — cartões: foto, nome, melhor preço de hoje + loja,
   variação vs. 7 dias atrás, selo "no alvo", ícone se algum anúncio está
   com erro. Botão "+ Adicionar produto".
2. **Adicionar (`/adicionar`)** — busca; resultados agrupados por loja
   carregando individualmente ("não respondeu" em falha); checkbox nos
   anúncios; campo "Colar link"; nome preenchido pelo primeiro anúncio
   marcado (editável); preço-alvo, modo do alvo e % de queda opcionais.
   Salvar dispara a primeira coleta.
3. **Detalhe (`/produto/:id`)** — melhor preço de hoje + "Ir para a loja";
   tabela "Hoje em cada loja" (à vista, a prazo/parcelas, disponibilidade,
   frete grátis, última checagem); gráfico de histórico (linha por loja,
   7 d / 30 d / tudo, linha tracejada do alvo); editar alvo/alerta;
   adicionar/remover anúncios (busca ou link); "Coletar agora"; arquivar.
4. **Status (`/status`)** — por loja: último sucesso, último erro, taxa de
   falha recente; botões "Testar Telegram" e "Testar Discord".
5. **Login (`/login`)** — senha única (`APP_PASSWORD`).

## 6. Erros e robustez

- Falha de um anúncio ou loja nunca interrompe o ciclo nem a busca nas
  outras lojas.
- Preço inválido (nulo nos dois modos, zero, não numérico) é rejeitado pela
  validação e conta como erro do anúncio.
- Produto removido da loja / página 404: `status = unavailable` ou `error`
  com mensagem clara na UI.
- Erros registrados em log estruturado (stdout) e visíveis em `/status`.

## 7. Testes

- **Vitest.**
- Parsers de cada loja testados com fixtures reais salvas em
  `tests/fixtures/<loja>/` (busca e página de produto).
- Unitários: melhor preço do dia, regras de alerta e antispam,
  `matches()` de cada loja, validação zod.
- `pnpm check:stores`: verificação manual ao vivo (busca + 1 produto por
  loja), imprime o que funcionou.
- Sem E2E na v1.

## 8. Configuração (env)

`APP_PASSWORD`, `NUXT_SESSION_PASSWORD`, `DATABASE_PATH`, `COLLECT_CRON`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `DISCORD_WEBHOOK_URL`,
`PROXY_URL_<LOJA>` (opcional).

## 9. Entrega em marcos

1. **Marco 1 — começar a coletar (meta ~3 dias):** base Nuxt, banco,
   login; adaptadores **Mercado Livre**, **KaBuM**, **Amazon**; coleta
   agendada; telas Lista, Adicionar, Detalhe; Docker + deploy no VPS.
2. **Marco 2 — alertas e lojas difíceis:** Telegram + Discord;
   adaptadores **Magalu**, **Casas Bahia/Ponto**, **Americanas**
   (Playwright); tela Status.
3. **Marco 3 — se houver tempo:** outras lojas (Carrefour, Fast Shop,
   Shopee etc.) e ajustes.

Se uma loja do marco bloquear o VPS, ela não segura o marco: fica marcada
como pendente e segue com proxy residencial ou coletor local como
alternativa.

## 10. Riscos

- **Bloqueio anti-bot / IP de datacenter** (Amazon, Magalu, Casas Bahia):
  mitigado por adaptadores isolados, baixa frequência, proxy opcional por
  loja e possibilidade de rodar o coletor localmente.
- **Mudança de layout das lojas:** parse isolado + fixtures + tela Status.
- **Prazo curto:** marcos priorizam coleta e histórico antes de alertas.
- **Termos de uso das lojas:** uso pessoal, volume baixo, sem
  redistribuição dos dados.
