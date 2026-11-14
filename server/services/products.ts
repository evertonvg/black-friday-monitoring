import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { isUniqueViolation, type Db } from '../db/client'
import { listings, products, type Listing, type Product } from '../db/schema'
import { getAdapter } from '../stores/registry'

export class DuplicateListingError extends Error {
  constructor() {
    super('Esse anúncio já está neste produto')
    this.name = 'DuplicateListingError'
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Produto não encontrado') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export const storeIdSchema = z.enum(['mercadolivre', 'kabum', 'amazon'])
export const priceModeSchema = z.enum(['cash', 'installment'])

export const newListingSchema = z.object({
  store: storeIdSchema,
  url: z.string().url(),
  title: z.string().trim().min(1),
  imageUrl: z.string().url().optional()
})

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  imageUrl: z.string().url().optional(),
  targetPriceCents: z.number().int().positive().optional(),
  targetMode: priceModeSchema.default('cash'),
  dropAlertPercent: z.number().int().min(1).max(90).optional(),
  listings: z.array(newListingSchema).min(1)
})

export const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  targetPriceCents: z.number().int().positive().nullable(),
  targetMode: priceModeSchema,
  dropAlertPercent: z.number().int().min(1).max(90).nullable(),
  archived: z.boolean()
}).partial()

export type NewListingInput = z.infer<typeof newListingSchema>
export type CreateProductInput = z.input<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>

function normalized(input: NewListingInput): NewListingInput {
  return { ...input, url: getAdapter(input.store).normalizeUrl(input.url) }
}

/*
 * Sem db.transaction(): no libsql, uma transação em banco ':memory:' abre outra conexão.
 * As duplicatas são checadas antes de gravar; se os anúncios falharem, o produto é desfeito.
 */
export async function createProduct(db: Db, raw: CreateProductInput): Promise<Product> {
  const input = createProductSchema.parse(raw)
  const items = input.listings.map(normalized)
  if (new Set(items.map(i => i.url)).size !== items.length) throw new DuplicateListingError()

  const [product] = await db.insert(products).values({
    name: input.name,
    imageUrl: input.imageUrl ?? items.find(i => i.imageUrl)?.imageUrl ?? null,
    targetPriceCents: input.targetPriceCents ?? null,
    targetMode: input.targetMode,
    dropAlertPercent: input.dropAlertPercent ?? null
  }).returning()

  try {
    await db.insert(listings).values(items.map(i => ({
      productId: product!.id,
      store: i.store,
      url: i.url,
      title: i.title,
      imageUrl: i.imageUrl ?? null
    })))
  } catch (error) {
    await db.delete(products).where(eq(products.id, product!.id))
    throw error
  }
  return product!
}

export async function updateProduct(db: Db, id: number, patch: UpdateProductInput): Promise<Product | null> {
  const values = updateProductSchema.parse(patch)
  if (Object.keys(values).length === 0) {
    const [current] = await db.select().from(products).where(eq(products.id, id))
    return current ?? null
  }
  const [updated] = await db.update(products).set(values).where(eq(products.id, id)).returning()
  return updated ?? null
}

export async function addListing(db: Db, productId: number, raw: NewListingInput): Promise<Listing> {
  const input = normalized(newListingSchema.parse(raw))
  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId))
  if (!product) throw new NotFoundError()
  try {
    const [listing] = await db.insert(listings).values({
      productId,
      store: input.store,
      url: input.url,
      title: input.title,
      imageUrl: input.imageUrl ?? null
    }).returning()
    return listing!
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateListingError()
    throw error
  }
}

export async function removeListing(db: Db, listingId: number): Promise<boolean> {
  const deleted = await db.delete(listings).where(eq(listings.id, listingId)).returning({ id: listings.id })
  return deleted.length > 0
}
