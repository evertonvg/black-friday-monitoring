import type { Db } from '../../server/db/client'
import { listings, priceSnapshots, products } from '../../server/db/schema'

export async function addProduct(db: Db, values: Partial<typeof products.$inferInsert> = {}) {
  const [row] = await db.insert(products).values({ name: 'Produto', ...values }).returning()
  return row!
}

let urlCounter = 0
export async function addListing(db: Db, productId: number, values: Partial<typeof listings.$inferInsert> = {}) {
  const [row] = await db.insert(listings).values({
    productId,
    store: 'kabum',
    url: `https://www.kabum.com.br/produto/${++urlCounter}`,
    title: 'Anúncio',
    ...values
  }).returning()
  return row!
}

export async function addSnapshot(db: Db, listingId: number, values: Partial<typeof priceSnapshots.$inferInsert> = {}) {
  const [row] = await db.insert(priceSnapshots).values({
    listingId,
    cashPriceCents: 100000,
    installmentPriceCents: 110000,
    installmentCount: 10,
    available: true,
    freeShipping: false,
    ...values
  }).returning()
  return row!
}
