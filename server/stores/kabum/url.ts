const HOSTS = new Set(['kabum.com.br', 'www.kabum.com.br'])

export function matches(url: string): boolean {
  try {
    return HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

export function productUrl(code: number | string): string {
  return `https://www.kabum.com.br/produto/${code}`
}

/** https://www.kabum.com.br/produto/<id>, sem slug, query ou hash. */
export function normalizeUrl(url: string): string {
  const match = new URL(url).pathname.match(/^\/produto\/(\d+)/)
  if (!match) throw new Error('Link do KaBuM não é de um produto')
  return productUrl(match[1]!)
}
