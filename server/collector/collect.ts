import { and, eq, inArray, sql } from 'drizzle-orm'
import pRetry from 'p-retry'
import type { Db } from '../db/client'
import { listings, priceSnapshots, products, type Listing } from '../db/schema'
import { BlockedError } from '../stores/errors'
import { getAdapter as defaultGetAdapter } from '../stores/registry'
import type { StoreAdapter, StoreId } from '../stores/types'
import { validateSnapshot } from '../stores/validate'

export interface CollectResult {
  listingId: number
  ok: boolean
  error?: string
}

export interface CollectDeps {
  getAdapter?: (id: StoreId) => StoreAdapter
  /** Espera mínima entre retentativas (ms). Padrão do p-retry: 1000. */
  retryMinTimeout?: number
}

export interface CycleDeps extends CollectDeps {
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

const MAX_ERROR_LENGTH = 500

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, MAX_ERROR_LENGTH)
}

async function collect(db: Db, listing: Listing, deps: CollectDeps): Promise<CollectResult> {
  const getAdapter = deps.getAdapter ?? defaultGetAdapter
  const now = new Date()
  try {
    const adapter = getAdapter(listing.store as StoreId)
    const page = await pRetry(() => adapter.fetchListing(listing.url), {
      retries: 2,
      minTimeout: deps.retryMinTimeout ?? 1000,
      shouldRetry: ({ error }) => !(error instanceof BlockedError)
    })
    const snapshot = validateSnapshot({
      cashPriceCents: page.cashPriceCents,
      installmentPriceCents: page.installmentPriceCents,
      installmentCount: page.installmentCount,
      available: page.available,
      freeShipping: page.freeShipping
    })

    await db.insert(priceSnapshots).values({ listingId: listing.id, capturedAt: now, ...snapshot })
    await db.update(listings).set({
      status: snapshot.available ? 'ok' : 'unavailable',
      lastError: null,
      lastCheckedAt: now,
      consecutiveFailures: 0
    }).where(eq(listings.id, listing.id))
    return { listingId: listing.id, ok: true }
  } catch (error) {
    const message = errorMessage(error)
    await db.update(listings).set({
      status: 'error',
      lastError: message,
      lastCheckedAt: now,
      consecutiveFailures: sql`${listings.consecutiveFailures} + 1`
    }).where(eq(listings.id, listing.id))
    return { listingId: listing.id, ok: false, error: message }
  }
}

/** Coleta um anúncio: grava o snapshot ou registra o erro. Nunca lança. */
export async function collectListing(db: Db, listingId: number, deps: CollectDeps = {}): Promise<CollectResult> {
  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId))
  if (!listing) return { listingId, ok: false, error: 'Anúncio não encontrado' }
  return collect(db, listing, deps)
}

/** Coleta todos os anúncios de um produto, em paralelo. */
export async function collectProduct(db: Db, productId: number, deps: CollectDeps = {}): Promise<CollectResult[]> {
  const rows = await db.select().from(listings).where(eq(listings.productId, productId))
  return Promise.all(rows.map(listing => collect(db, listing, deps)))
}

let cycleRunning = false

/**
 * Ciclo de coleta: anúncios de produtos não arquivados, lojas em paralelo,
 * itens da mesma loja em sequência com espera aleatória de 2–6 s entre eles.
 */
export async function runCycle(db: Db, deps: CycleDeps = {}): Promise<{ skipped: boolean, results: CollectResult[] }> {
  if (cycleRunning) return { skipped: true, results: [] }
  cycleRunning = true
  try {
    const sleep = deps.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)))
    const random = deps.random ?? Math.random

    const activeIds = db.select({ id: products.id }).from(products).where(eq(products.archived, false))
    const rows = await db.select().from(listings).where(and(inArray(listings.productId, activeIds)))

    const byStore = new Map<string, Listing[]>()
    for (const row of rows) byStore.set(row.store, [...(byStore.get(row.store) ?? []), row])

    const perStore = await Promise.all([...byStore.values()].map(async (storeListings) => {
      const results: CollectResult[] = []
      for (const [index, listing] of storeListings.entries()) {
        if (index > 0) await sleep(2000 + random() * 4000)
        results.push(await collect(db, listing, deps))
      }
      return results
    }))
    return { skipped: false, results: perStore.flat() }
  } finally {
    cycleRunning = false
  }
}
