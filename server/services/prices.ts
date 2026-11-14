import { and, asc, eq, gte, inArray } from 'drizzle-orm'
import type { Db } from '../db/client'
import { listings, priceSnapshots, products, type Listing, type ListingStatus, type PriceMode, type PriceSnapshot, type Product } from '../db/schema'
import type { StoreId } from '../stores/types'

export interface StorePrice {
  listingId: number
  store: StoreId
  title: string
  url: string
  status: ListingStatus
  cashPriceCents: number | null
  installmentPriceCents: number | null
  installmentCount: number | null
  available: boolean
  freeShipping: boolean
  capturedAt: Date | null
  lastError: string | null
}

export interface ProductSummary {
  id: number
  name: string
  imageUrl: string | null
  state: 'pending' | 'soldout' | 'ok'
  best: StorePrice | null
  change7dPercent: number | null
  onTarget: boolean
  hasError: boolean
}

export interface ProductDetail extends ProductSummary {
  product: Product
  stores: StorePrice[]
  lowestEver: { cents: number, store: StoreId, at: Date } | null
  price7dAgo: number | null
}

export type HistoryRange = '7d' | '30d' | 'all'

export interface HistorySeries {
  listingId: number
  store: StoreId
  title: string
  points: { t: Date, cash: number | null, installment: number | null, available: boolean }[]
}

const DAY_MS = 24 * 60 * 60 * 1000

const priceIn = (p: { cashPriceCents: number | null, installmentPriceCents: number | null }, mode: PriceMode) =>
  mode === 'cash' ? p.cashPriceCents : p.installmentPriceCents

/** Menor preço disponível no modo; empate → o mais recente. */
export function pickBest(prices: StorePrice[], mode: PriceMode): StorePrice | null {
  let best: StorePrice | null = null
  for (const candidate of prices) {
    const price = priceIn(candidate, mode)
    if (!candidate.available || price === null) continue
    const bestPrice = best ? priceIn(best, mode)! : Infinity
    const newer = (candidate.capturedAt?.getTime() ?? 0) > (best?.capturedAt?.getTime() ?? 0)
    if (price < bestPrice || (price === bestPrice && newer)) best = candidate
  }
  return best
}

function toStorePrice(listing: Listing, snapshot: PriceSnapshot | undefined): StorePrice {
  return {
    listingId: listing.id,
    store: listing.store as StoreId,
    title: listing.title,
    url: listing.url,
    status: listing.status,
    cashPriceCents: snapshot?.cashPriceCents ?? null,
    installmentPriceCents: snapshot?.installmentPriceCents ?? null,
    installmentCount: snapshot?.installmentCount ?? null,
    available: snapshot?.available ?? false,
    freeShipping: snapshot?.freeShipping ?? false,
    capturedAt: snapshot?.capturedAt ?? null,
    lastError: listing.lastError
  }
}

/** Último snapshot de cada anúncio com capturedAt <= limite. Snapshots em ordem crescente de data. */
function latestPerListing(snapshots: PriceSnapshot[], until: Date): Map<number, PriceSnapshot> {
  const latest = new Map<number, PriceSnapshot>()
  for (const s of snapshots) if (s.capturedAt <= until) latest.set(s.listingId, s)
  return latest
}

async function loadProducts(db: Db, productIds: number[]) {
  if (productIds.length === 0) return { listingRows: [] as Listing[], snapshotRows: [] as PriceSnapshot[] }
  const listingRows = await db.select().from(listings).where(inArray(listings.productId, productIds)).orderBy(asc(listings.id))
  const listingIds = listingRows.map(l => l.id)
  const snapshotRows = listingIds.length === 0
    ? []
    : await db.select().from(priceSnapshots).where(inArray(priceSnapshots.listingId, listingIds)).orderBy(asc(priceSnapshots.capturedAt), asc(priceSnapshots.id))
  return { listingRows, snapshotRows }
}

function summarize(product: Product, productListings: Listing[], snapshots: PriceSnapshot[], mode: PriceMode, now: Date) {
  const current = latestPerListing(snapshots, now)
  const past = latestPerListing(snapshots, new Date(now.getTime() - 7 * DAY_MS))

  const stores = productListings.map(l => toStorePrice(l, current.get(l.id)))
  const best = pickBest(stores, mode)
  const bestPast = pickBest(productListings.map(l => toStorePrice(l, past.get(l.id))), mode)
  const bestPrice = best ? priceIn(best, mode) : null
  const price7dAgo = bestPast ? priceIn(bestPast, mode) : null

  const targetBest = pickBest(stores, product.targetMode)
  const targetPrice = targetBest ? priceIn(targetBest, product.targetMode) : null

  const summary: ProductSummary = {
    id: product.id,
    name: product.name,
    imageUrl: product.imageUrl,
    state: current.size === 0 ? 'pending' : best ? 'ok' : 'soldout',
    best,
    change7dPercent: bestPrice !== null && price7dAgo !== null
      ? Math.round(((bestPrice - price7dAgo) / price7dAgo) * 1000) / 10
      : null,
    onTarget: product.targetPriceCents !== null && targetPrice !== null && targetPrice <= product.targetPriceCents,
    hasError: productListings.some(l => l.status === 'error')
  }
  return { summary, stores, price7dAgo }
}

export async function listSummaries(db: Db, mode: PriceMode, now: Date = new Date()): Promise<ProductSummary[]> {
  const productRows = await db.select().from(products).where(eq(products.archived, false)).orderBy(asc(products.createdAt), asc(products.id))
  const { listingRows, snapshotRows } = await loadProducts(db, productRows.map(p => p.id))
  return productRows.map((product) => {
    const own = listingRows.filter(l => l.productId === product.id)
    const ownIds = new Set(own.map(l => l.id))
    return summarize(product, own, snapshotRows.filter(s => ownIds.has(s.listingId)), mode, now).summary
  })
}

export async function getProductDetail(db: Db, id: number, mode: PriceMode, now: Date = new Date()): Promise<ProductDetail | null> {
  const [product] = await db.select().from(products).where(eq(products.id, id))
  if (!product) return null
  const { listingRows, snapshotRows } = await loadProducts(db, [id])
  const { summary, stores, price7dAgo } = summarize(product, listingRows, snapshotRows, mode, now)

  const rank = (s: StorePrice) => {
    const price = priceIn(s, mode)
    return s.available && price !== null ? price : Infinity
  }
  const sorted = [...stores].sort((a, b) => rank(a) - rank(b))

  let lowestEver: ProductDetail['lowestEver'] = null
  for (const s of snapshotRows) {
    const price = priceIn(s, mode)
    if (!s.available || price === null || s.capturedAt > now) continue
    if (!lowestEver || price < lowestEver.cents) {
      const listing = listingRows.find(l => l.id === s.listingId)!
      lowestEver = { cents: price, store: listing.store as StoreId, at: s.capturedAt }
    }
  }

  return { ...summary, product, stores: sorted, lowestEver, price7dAgo }
}

export async function getHistory(db: Db, productId: number, range: HistoryRange, now: Date = new Date()): Promise<HistorySeries[]> {
  const listingRows = await db.select().from(listings).where(eq(listings.productId, productId)).orderBy(asc(listings.id))
  if (listingRows.length === 0) return []
  const since = range === 'all' ? null : new Date(now.getTime() - (range === '7d' ? 7 : 30) * DAY_MS)
  const where = since
    ? and(inArray(priceSnapshots.listingId, listingRows.map(l => l.id)), gte(priceSnapshots.capturedAt, since))
    : inArray(priceSnapshots.listingId, listingRows.map(l => l.id))
  const snapshotRows = await db.select().from(priceSnapshots).where(where).orderBy(asc(priceSnapshots.capturedAt))

  return listingRows.map(l => ({
    listingId: l.id,
    store: l.store as StoreId,
    title: l.title,
    points: snapshotRows
      .filter(s => s.listingId === l.id)
      .map(s => ({ t: s.capturedAt, cash: s.cashPriceCents, installment: s.installmentPriceCents, available: s.available }))
  }))
}
