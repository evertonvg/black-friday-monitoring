import { gotScraping } from 'got-scraping'
import { BlockedError } from './errors'
import type { StoreId } from './types'

const BLOCKED_STATUS = new Set([403, 429, 503])

function proxyFor(store: StoreId): string | undefined {
  return process.env[`PROXY_URL_${store.toUpperCase()}`] || undefined
}

/** Baixa uma página com cabeçalhos de navegador (pt-BR) e proxy opcional por loja. */
export async function fetchHtml(store: StoreId, url: string, opts: { signal?: AbortSignal } = {}): Promise<string> {
  const response = await gotScraping({
    url,
    proxyUrl: proxyFor(store),
    timeout: { request: 20_000 },
    signal: opts.signal,
    throwHttpErrors: false,
    followRedirect: true,
    headerGeneratorOptions: {
      browsers: ['chrome'],
      devices: ['desktop'],
      locales: ['pt-BR'],
      operatingSystems: ['windows']
    }
  })
  if (BLOCKED_STATUS.has(response.statusCode)) throw new BlockedError()
  if (response.statusCode >= 400) throw new Error(`HTTP ${response.statusCode} em ${url}`)
  return response.body
}

export async function fetchJson<T>(store: StoreId, url: string, opts: { signal?: AbortSignal } = {}): Promise<T> {
  return JSON.parse(await fetchHtml(store, url, opts)) as T
}
