import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export type PriceMode = 'cash' | 'installment'
export type ListingStatus = 'pending' | 'ok' | 'unavailable' | 'error'
export type AlertKind = 'target' | 'drop' | 'store_health'

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch('subsec') * 1000)`)

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  imageUrl: text('image_url'),
  createdAt: createdAt(),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  targetPriceCents: integer('target_price_cents'),
  targetMode: text('target_mode').$type<PriceMode>().notNull().default('cash'),
  dropAlertPercent: integer('drop_alert_percent')
})

export const listings = sqliteTable('listings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  store: text('store').notNull(),
  url: text('url').notNull(),
  title: text('title').notNull(),
  imageUrl: text('image_url'),
  status: text('status').$type<ListingStatus>().notNull().default('pending'),
  lastError: text('last_error'),
  lastCheckedAt: integer('last_checked_at', { mode: 'timestamp_ms' }),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  createdAt: createdAt()
}, t => [uniqueIndex('listings_product_url_unique').on(t.productId, t.url)])

export const priceSnapshots = sqliteTable('price_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  listingId: integer('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
  capturedAt: integer('captured_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch('subsec') * 1000)`),
  cashPriceCents: integer('cash_price_cents'),
  installmentPriceCents: integer('installment_price_cents'),
  installmentCount: integer('installment_count'),
  available: integer('available', { mode: 'boolean' }).notNull(),
  freeShipping: integer('free_shipping', { mode: 'boolean' }).notNull().default(false)
}, t => [index('price_snapshots_listing_captured_idx').on(t.listingId, t.capturedAt)])

export const alertsSent = sqliteTable('alerts_sent', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }),
  listingId: integer('listing_id').references(() => listings.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<AlertKind>().notNull(),
  priceCents: integer('price_cents'),
  sentAt: integer('sent_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch('subsec') * 1000)`)
})

export type Product = typeof products.$inferSelect
export type Listing = typeof listings.$inferSelect
export type PriceSnapshot = typeof priceSnapshots.$inferSelect
