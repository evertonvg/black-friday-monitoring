import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb } from '../helpers/db'
import { addProduct } from '../helpers/seed'
import { listings, products } from '../../server/db/schema'
import {
  addListing,
  createProduct,
  createProductSchema,
  DuplicateListingError,
  removeListing,
  updateProduct
} from '../../server/services/products'

const kabumListing = (url: string) => ({ store: 'kabum' as const, url, title: 'TV KaBuM' })

describe('createProduct', () => {
  it('normaliza URLs e cria os anúncios', async () => {
    const db = await testDb()
    const product = await createProduct(db, {
      name: 'TV 55',
      targetMode: 'cash',
      listings: [
        { store: 'amazon', url: 'https://www.amazon.com.br/Smart-TV/dp/B0C1234567/ref=sr_1_3?keywords=tv', title: 'TV Amazon' },
        kabumListing('https://www.kabum.com.br/produto/123456/tv?utm_source=x')
      ]
    })
    const rows = await db.select().from(listings).where(eq(listings.productId, product.id))
    expect(rows.map(r => r.url).sort()).toEqual([
      'https://www.amazon.com.br/dp/B0C1234567',
      'https://www.kabum.com.br/produto/123456'
    ])
    expect(rows.every(r => r.status === 'pending')).toBe(true)
  })

  it('recusa a mesma URL duas vezes e não cria o produto', async () => {
    const db = await testDb()
    await expect(createProduct(db, {
      name: 'TV',
      targetMode: 'cash',
      listings: [
        kabumListing('https://www.kabum.com.br/produto/123456/tv-55'),
        kabumListing('https://www.kabum.com.br/produto/123456?utm=1')
      ]
    })).rejects.toThrow(DuplicateListingError)
    expect(await db.select().from(products)).toHaveLength(0)
  })
})

describe('addListing', () => {
  it('recusa anúncio já existente no produto', async () => {
    const db = await testDb()
    const product = await createProduct(db, {
      name: 'TV',
      targetMode: 'cash',
      listings: [kabumListing('https://www.kabum.com.br/produto/1')]
    })
    await expect(addListing(db, product.id, kabumListing('https://www.kabum.com.br/produto/1/slug')))
      .rejects.toThrow('Esse anúncio já está neste produto')
  })

  it('adiciona anúncio normalizado', async () => {
    const db = await testDb()
    const product = await addProduct(db)
    const listing = await addListing(db, product.id, { store: 'amazon', url: 'https://amazon.com.br/gp/product/B0C1234567', title: 'x' })
    expect(listing.url).toBe('https://www.amazon.com.br/dp/B0C1234567')
  })
})

describe('createProductSchema', () => {
  const base = { name: 'TV', listings: [kabumListing('https://www.kabum.com.br/produto/1')] }

  it('aceita o mínimo e usa cash como modo padrão', () =>
    expect(createProductSchema.parse(base).targetMode).toBe('cash'))
  it('recusa lista de anúncios vazia', () =>
    expect(() => createProductSchema.parse({ ...base, listings: [] })).toThrow())
  it('recusa alvo 0', () =>
    expect(() => createProductSchema.parse({ ...base, targetPriceCents: 0 })).toThrow())
})

describe('updateProduct', () => {
  it('limpa o alvo com null e arquiva', async () => {
    const db = await testDb()
    const product = await addProduct(db, { targetPriceCents: 1000 })
    const updated = await updateProduct(db, product.id, { targetPriceCents: null, archived: true })
    expect(updated).toMatchObject({ targetPriceCents: null, archived: true })
  })

  it('produto inexistente → null', async () => {
    const db = await testDb()
    expect(await updateProduct(db, 999, { name: 'x' })).toBeNull()
  })
})

describe('removeListing', () => {
  it('devolve false para id inexistente', async () => {
    const db = await testDb()
    expect(await removeListing(db, 999)).toBe(false)
  })
})
