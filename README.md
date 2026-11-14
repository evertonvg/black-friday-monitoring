# Monitor BF

Monitor de preços pessoal para a Black Friday. Você busca um produto nas lojas,
marca os anúncios que são o mesmo produto, e o app coleta os preços periodicamente,
mostra o melhor preço do dia (à vista ou a prazo) e o histórico por loja.

Lojas suportadas hoje: **KaBuM!** e **Amazon**. O Mercado Livre está pendente: a API
pública passou a exigir autenticação e a busca via HTTP retorna um desafio anti-bot.

## Requisitos

- Um VPS com **2 GB de RAM** ou mais e Docker + Docker Compose instalados.
- Um domínio ou subdomínio apontando (registro A) para o IP do VPS, para o HTTPS automático.

## Configuração

Copie o exemplo e preencha:

```bash
cp .env.example .env
```

| Variável | Para que serve |
|---|---|
| `APP_PASSWORD` | Senha única para entrar no app. |
| `NUXT_APP_SECRET` | Segredo que protege o cookie de sessão (mínimo 32 caracteres). Gere com `openssl rand -base64 32`. |
| `DATABASE_PATH` | Caminho do banco SQLite. No Docker já é `/data/app.db`. |
| `COLLECT_CRON` | Agenda da coleta (cron, fuso de São Paulo). Padrão: a cada 3 horas (`0 */3 * * *`). Na semana da Black Friday, use `0 * * * *` (de hora em hora). |
| `COLLECT_ENABLED` | `false` desliga o agendador. |
| `PROXY_URL_<LOJA>` | Opcional. Proxy usado só para aquela loja (ex.: `PROXY_URL_AMAZON`). Veja "Loja bloqueada". |
| `DOMAIN` | Domínio usado pelo Caddy para o HTTPS (ex.: `precos.seudominio.com`). |

## Subir no servidor

```bash
docker compose up -d --build
```

O app fica em `https://<DOMAIN>`. Ver os logs:

```bash
docker compose logs -f app
```

Os logs mostram cada ciclo de coleta (`[coleta] ciclo concluído ... ok, ... com erro`).

## Dados e backup

- O banco fica no volume Docker `data`, em `/data/app.db`.
- Todo dia às 04:00 é feita uma cópia em `/data/backups/app-AAAA-MM-DD.db`. Ficam os 7 últimos dias.
- Copiar o backup mais recente para a sua máquina:

  ```bash
  docker compose cp app:/data/backups ./backups
  ```

## Verificar as lojas

Em desenvolvimento (com Node 24 e pnpm):

```bash
pnpm install
pnpm check:stores "smart tv 55"
```

Mostra, por loja, se a busca e a leitura de preço funcionaram.

## Loja bloqueada

Se uma loja aparecer com erro "Bloqueado pela loja", ela está recusando os acessos
vindos do servidor. Isso é comum com IPs de datacenter. As saídas são:

1. **Diminuir a frequência** da coleta (`COLLECT_CRON`).
2. Configurar um **proxy residencial** só para aquela loja, em `PROXY_URL_<LOJA>`.

## Desenvolvimento

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm test           # testes unitários
pnpm test:e2e       # testes de ponta a ponta (faz o build do app)
pnpm typecheck
```

Os parsers de cada loja são testados com páginas reais salvas em `tests/fixtures/<loja>/`.
Quando uma loja mudar o site, salve a nova página com
`pnpm capture <loja> <nome> <url>` e ajuste o parser em `server/stores/<loja>/parse.ts`.
