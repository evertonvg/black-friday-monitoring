import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb } from '../helpers/db'
import { isUniqueViolation } from '../../server/db/client'
import { products, listings, priceSnapshots } from '../../server/db/schema'

async function seed() {
  const db = await testDb()
  const [product] = await db.insert(products).values({ name: 'TV 55' }).returning()
  const [listing] = await db.insert(listings).values({
    productId: product!.id,
    store: 'kabum',
    url: 'https://www.kabum.com.br/produto/1',
    title: 'TV'
  }).returning()
  return { db, product: product!, listing: listing! }
}

describe('db', () => {
  it('cria produto, anúncio e snapshot e lê de volta', async () => {
    const { db, product, listing } = await seed()
    expect(product.archived).toBe(false)
    expect(product.targetMode).toBe('cash')
    expect(listing.status).toBe('pending')
    expect(listing.consecutiveFailures).toBe(0)

    await db.insert(priceSnapshots).values({
      listingId: listing.id,
      cashPriceCents: 249900,
      installmentPriceCents: 279900,
      installmentCount: 10,
      available: true,
      freeShipping: false
    })
    const [snap] = await db.select().from(priceSnapshots).where(eq(priceSnapshots.listingId, listing.id))
    expect(snap).toMatchObject({
      cashPriceCents: 249900,
      installmentPriceCents: 279900,
      installmentCount: 10,
      available: true,
      freeShipping: false
    })
    expect(snap!.capturedAt).toBeInstanceOf(Date)
  })

  it('rejeita URL duplicada no mesmo produto', async () => {
    const { db, product } = await seed()
    const error = await db.insert(listings).values({
      productId: product.id,
      store: 'kabum',
      url: 'https://www.kabum.com.br/produto/1',
      title: 'TV de novo'
    }).then(() => null, (e: unknown) => e)
    expect(error).toBeInstanceOf(Error)
    expect(isUniqueViolation(error)).toBe(true)
    expect(isUniqueViolation(new Error('outra coisa'))).toBe(false)
  })

  it('apaga em cascata', async () => {
    const { db, product, listing } = await seed()
    await db.insert(priceSnapshots).values({
      listingId: listing.id, cashPriceCents: 100, installmentPriceCents: null,
      installmentCount: null, available: true, freeShipping: false
    })
    await db.delete(products).where(eq(products.id, product.id))
    expect(await db.select().from(listings)).toHaveLength(0)
    expect(await db.select().from(priceSnapshots)).toHaveLength(0)
  })
})
