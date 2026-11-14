export type StoreId = 'mercadolivre' | 'kabum' | 'amazon'

export interface SearchResult {
  store: StoreId
  url: string
  title: string
  imageUrl?: string
  cashPriceCents?: number
}

export interface PriceSnapshotInput {
  cashPriceCents: number | null
  installmentPriceCents: number | null
  installmentCount: number | null
  available: boolean
  freeShipping: boolean
}

export interface ListingPage extends PriceSnapshotInput {
  title: string
  imageUrl?: string
}

export interface StoreAdapter {
  id: StoreId
  name: string
  /** Reconhece se a URL é desta loja. */
  matches(url: string): boolean
  /** Forma canônica da URL; lança ShortLinkError para link curto. */
  normalizeUrl(url: string): string
  search(term: string, signal?: AbortSignal): Promise<SearchResult[]>
  fetchListing(url: string): Promise<ListingPage>
}
