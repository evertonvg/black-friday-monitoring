import { ShortLinkError } from '../errors'

const HOSTS = new Set(['amazon.com.br', 'www.amazon.com.br'])
const SHORT_HOSTS = new Set(['amzn.to', 'a.co', 'amzn.com'])
const ASIN = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?=[/?#]|$)/i

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

/** Inclui os encurtadores para que o usuário receba a mensagem de link curto. */
export function matches(url: string): boolean {
  const host = hostOf(url)
  return host !== null && (HOSTS.has(host) || SHORT_HOSTS.has(host))
}

export function productUrl(asin: string): string {
  return `https://www.amazon.com.br/dp/${asin.toUpperCase()}`
}

/** https://www.amazon.com.br/dp/<ASIN>; link curto → ShortLinkError. */
export function normalizeUrl(url: string): string {
  const parsed = new URL(url)
  if (SHORT_HOSTS.has(parsed.hostname)) throw new ShortLinkError()
  const match = parsed.pathname.match(ASIN)
  if (!match) throw new Error('Link da Amazon sem código do produto (ASIN)')
  return productUrl(match[1]!)
}
