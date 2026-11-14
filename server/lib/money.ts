const NUMBER = /\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?/

const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Converte um texto de preço brasileiro ("R$ 1.299,90") em centavos.
 * Se houver "R$", usa o primeiro número depois dele; senão, o primeiro número.
 * Devolve null quando não há número ou o valor é zero.
 */
export function parseBRL(text: string): number | null {
  const normalized = text.replace(/ /g, ' ')
  const currencyAt = normalized.indexOf('R$')
  const source = currencyAt >= 0 ? normalized.slice(currencyAt + 2) : normalized
  const match = source.match(NUMBER)
  if (!match) return null

  const [intPart = '', decPart = ''] = match[0].split(',')
  const reais = Number(intPart.replace(/\./g, ''))
  const centavos = Number(decPart.padEnd(2, '0'))
  const cents = reais * 100 + centavos
  return Number.isFinite(cents) && cents > 0 ? cents : null
}

export function formatBRL(cents: number): string {
  return formatter.format(cents / 100)
}
