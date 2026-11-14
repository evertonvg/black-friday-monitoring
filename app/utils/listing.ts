import type { PriceMode } from './price-mode'

/** Anúncio escolhido na busca ou por link colado. */
export interface PickedListing {
  store: string
  url: string
  title: string
  imageUrl?: string
  cashPriceCents?: number | null
}

export interface AlertSettings {
  targetPriceCents: number | null
  targetMode: PriceMode
  dropAlertPercent: number | null
}

/** Mensagem de erro vinda da API ($fetch / useFetch), com texto padrão. */
export function apiErrorMessage(error: unknown, fallback = 'Algo deu errado'): string {
  const e = error as { data?: { statusMessage?: string, message?: string }, statusMessage?: string } | null
  return e?.data?.statusMessage ?? e?.statusMessage ?? fallback
}
