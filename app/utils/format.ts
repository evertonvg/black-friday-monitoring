const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })
const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' })

export const formatBRL = (cents: number) => currency.format(cents / 100)
export const formatDateTime = (value: string | Date) => dateTime.format(new Date(value))
export const formatDate = (value: string | Date) => date.format(new Date(value))

export function formatAgo(value: string | Date): string {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  return `há ${Math.round(hours / 24)} d`
}

export const STORE_NAMES: Record<string, string> = {
  mercadolivre: 'Mercado Livre',
  kabum: 'KaBuM!',
  amazon: 'Amazon'
}

export const storeName = (id: string) => STORE_NAMES[id] ?? id
