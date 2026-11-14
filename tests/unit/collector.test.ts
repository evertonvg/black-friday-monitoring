import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb } from '../helpers/db'
import { addListing, addProduct } from '../helpers/seed'
import { collectListing, runCycle } from '../../server/collector/collect'
import type { Db } from '../../server/db/client'
import { listings, priceSnapshots } from '../../server/db/schema'
import { BlockedError } from '../../server/stores/errors'
import type { ListingPage, StoreAdapter } from '../../server/stores/types'

const page: ListingPage = {
  title: 'TV',
  cashPriceCents: 199900,
  installmentPriceCents: 219900,
  installmentCount: 10,
  available: true,
  freeShipping: true
}

function fakeAdapter(fetchListing: (url: string) => Promise<ListingPage>): StoreAdapter {
  return {
    id: 'kabum',
    name: 'Fake',
    matches: () => true,
    normalizeUrl: u => u,
    search: async () => [],
    fetchListing
  }
}

const deps = (adapter: StoreAdapter) => ({ getAdapter: () => adapter, retryMinTimeout: 0 })

async function setup() {
  const db = await testDb()
  const product = await addProduct(db)
  const listing = await addListing(db, product.id)
  return { db, product, listing }
}

const getListing = async (db: Db, id: number) =>
  (await db.select().from(listings).where(eq(listings.id, id)))[0]!
const getSnapshots = (db: Db, id: number) =>
  db.select().from(priceSnapshots).where(eq(priceSnapshots.listingId, id))

describe('collectListing', () => {
  it('grava snapshot e marca ok', async () => {
    const { db, listing } = await setup()
    const result = await collectListing(db, listing.id, deps(fakeAdapter(async () => page)))
    expect(result).toEqual({ listingId: listing.id, ok: true })
    const [snap] = await getSnapshots(db, listing.id)
    expect(snap).toMatchObject({ cashPriceCents: 199900, installmentPriceCents: 219900, installmentCount: 10, available: true, freeShipping: true })
    const row = await getListing(db, listing.id)
    expect(row.status).toBe('ok')
    expect(row.lastCheckedAt).toBeInstanceOf(Date)
    expect(row.lastError).toBeNull()
  })

  it('produto esgotado grava snapshot com available=false e status unavailable', async () => {
    const { db, listing } = await setup()
    const soldout = { ...page, available: false, cashPriceCents: null, installmentPriceCents: null, installmentCount: null }
    await collectListing(db, listing.id, deps(fakeAdapter(async () => soldout)))
    expect((await getSnapshots(db, listing.id))[0]!.available).toBe(false)
    expect((await getListing(db, listing.id)).status).toBe('unavailable')
  })

  it('erro: status error, consecutiveFailures incrementa, sem snapshot', async () => {
    const { db, listing } = await setup()
    const failing = deps(fakeAdapter(async () => {
      throw new Error('caiu')
    }))
    expect(await collectListing(db, listing.id, failing)).toEqual({ listingId: listing.id, ok: false, error: 'caiu' })
    await collectListing(db, listing.id, failing)
    let row = await getListing(db, listing.id)
    expect(row).toMatchObject({ status: 'error', lastError: 'caiu', consecutiveFailures: 2 })
    expect(await getSnapshots(db, listing.id)).toHaveLength(0)

    await collectListing(db, listing.id, deps(fakeAdapter(async () => page)))
    row = await getListing(db, listing.id)
    expect(row).toMatchObject({ status: 'ok', lastError: null, consecutiveFailures: 0 })
  })

  it('tenta de novo 2 vezes antes de desistir', async () => {
    const { db, listing } = await setup()
    let calls = 0
    const result = await collectListing(db, listing.id, deps(fakeAdapter(async () => {
      calls++
      if (calls < 3) throw new Error('instável')
      return page
    })))
    expect(result.ok).toBe(true)
    expect(calls).toBe(3)
  })

  it('BlockedError não é retentado e grava "Bloqueado pela loja"', async () => {
    const { db, listing } = await setup()
    let calls = 0
    await collectListing(db, listing.id, deps(fakeAdapter(async () => {
      calls++
      throw new BlockedError()
    })))
    expect(calls).toBe(1)
    expect((await getListing(db, listing.id)).lastError).toContain('Bloqueado')
  })

  it('snapshot inválido conta como erro', async () => {
    const { db, listing } = await setup()
    const invalid = { ...page, cashPriceCents: null, installmentPriceCents: null }
    const result = await collectListing(db, listing.id, deps(fakeAdapter(async () => invalid)))
    expect(result.ok).toBe(false)
    expect((await getListing(db, listing.id)).status).toBe('error')
    expect(await getSnapshots(db, listing.id)).toHaveLength(0)
  })

  it('erro longo é cortado em 500 caracteres', async () => {
    const { db, listing } = await setup()
    await collectListing(db, listing.id, deps(fakeAdapter(async () => {
      throw new Error('x'.repeat(2000))
    })))
    expect((await getListing(db, listing.id)).lastError).toHaveLength(500)
  })
})

describe('runCycle', () => {
  const noSleep = { sleep: async () => {}, random: () => 0 }

  it('ignora produtos arquivados', async () => {
    const db = await testDb()
    const active = await addProduct(db)
    const archived = await addProduct(db, { archived: true })
    const a = await addListing(db, active.id)
    await addListing(db, archived.id)
    const { results } = await runCycle(db, { ...deps(fakeAdapter(async () => page)), ...noSleep })
    expect(results.map(r => r.listingId)).toEqual([a.id])
  })

  it('ciclo concorrente devolve skipped', async () => {
    const db = await testDb()
    const product = await addProduct(db)
    await addListing(db, product.id)
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const slow = deps(fakeAdapter(async () => {
      await gate
      return page
    }))
    const first = runCycle(db, { ...slow, ...noSleep })
    const second = await runCycle(db, { ...slow, ...noSleep })
    expect(second).toEqual({ skipped: true, results: [] })
    release()
    expect((await first).skipped).toBe(false)
  })

  it('espera de 2 a 6 s entre itens da mesma loja', async () => {
    const db = await testDb()
    const product = await addProduct(db)
    for (let i = 0; i < 3; i++) await addListing(db, product.id)
    const waits: number[] = []
    let r = 0
    await runCycle(db, {
      ...deps(fakeAdapter(async () => page)),
      sleep: async (ms) => {
        waits.push(ms)
      },
      random: () => [0, 0.999][r++ % 2]!
    })
    expect(waits).toHaveLength(2)
    for (const ms of waits) {
      expect(ms).toBeGreaterThanOrEqual(2000)
      expect(ms).toBeLessThanOrEqual(6000)
    }
  })
})
