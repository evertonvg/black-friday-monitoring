// Uso: pnpm check:stores [termo]
// Busca o termo em cada loja, lê o primeiro produto e mostra o que funcionou.
import { formatBRL } from '../server/lib/money'
import { listAdapters } from '../server/stores/registry'

const term = process.argv.slice(2).join(' ') || 'smart tv 55'
let failures = 0

console.log(`Verificando lojas com "${term}"…\n`)

for (const adapter of listAdapters()) {
  try {
    const results = await adapter.search(term, AbortSignal.timeout(20_000))
    if (results.length === 0) throw new Error('busca sem resultados')
    const page = await adapter.fetchListing(results[0]!.url)
    const cash = page.cashPriceCents ? `${formatBRL(page.cashPriceCents)} à vista` : 'sem preço à vista'
    const installment = page.installmentPriceCents && page.installmentCount
      ? ` / ${formatBRL(page.installmentPriceCents)} em até ${page.installmentCount}x`
      : ''
    console.log(`✔ ${adapter.name} — ${results.length} resultados — ${page.available ? cash + installment : 'esgotado'}`)
  } catch (error) {
    failures++
    console.log(`✘ ${adapter.name} — ${error instanceof Error ? error.message : String(error)}`)
  }
}

process.exit(failures > 0 ? 1 : 0)
