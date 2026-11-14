// Uso: pnpm capture <loja> <nome> <url>
// Salva a página em tests/fixtures/<loja>/<nome>.html para testar os parsers.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fetchHtml } from '../server/stores/http'
import type { StoreId } from '../server/stores/types'

const [store, name, url] = process.argv.slice(2)
if (!store || !name || !url) {
  console.error('Uso: pnpm capture <loja> <nome> <url>')
  process.exit(1)
}

const html = await fetchHtml(store as StoreId, url)
const dir = `tests/fixtures/${store}`
mkdirSync(dir, { recursive: true })
writeFileSync(`${dir}/${name}.html`, html)
console.log(`Salvo ${dir}/${name}.html (${html.length} bytes)`)
