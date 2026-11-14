import { describe, it, expect } from 'vitest'
import { testDb } from '../helpers/db'
import { addListing, addProduct, addSnapshot } from '../helpers/seed'
import { getHistory, getProductDetail, listSummaries, pickBest, type StorePrice } from '../../server/services/prices'

const NOW = new Date('2026-11-20T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000)

function storePrice(values: Partial<StorePrice>): StorePrice {
  return {
    listingId: 1,
    store: 'kabum',
    title: 'x',
    url: 'https://x',
    status: 'ok',
    cashPriceCents: 100000,
    installmentPriceCents: 110000,
    installmentCount: 10,
    available: true,
    freeShipping: false,
    capturedAt: NOW,
    lastError: null,
    ...values
  }
}

describe('pickBest', () => {
  const a = storePrice({ listingId: 1, cashPriceCents: 90000, installmentPriceCents: 120000 })
  const b = storePrice({ listingId: 2, cashPriceCents: 95000, installmentPriceCents: 100000 })

  it('menor preço à vista', () => expect(pickBest([a, b], 'cash')).toBe(a))
  it('menor preço a prazo', () => expect(pickBest([a, b], 'installment')).toBe(b))
  it('ignora indisponível', () =>
    expect(pickBest([{ ...a, available: false }, b], 'cash')).toBe(b))
  it('ignora preço nulo no modo', () =>
    expect(pickBest([{ ...a, cashPriceCents: null }, b], 'cash')).toBe(b))
  it('lista vazia → null', () => expect(pickBest([], 'cash')).toBeNull())
  it('empate → o mais recente', () => {
    const older = storePrice({ listingId: 3, cashPriceCents: 90000, capturedAt: daysAgo(1) })
    expect(pickBest([older, a], 'cash')).toBe(a)
  })
})

describe('listSummaries', () => {
  it('produto sem coleta → pending, best null', async () => {
    const db = await testDb()
    const p = await addProduct(db)
    await addListing(db, p.id)
    const [summary] = await listSummaries(db, 'cash', NOW)
    expect(summary).toMatchObject({ id: p.id, state: 'pending', best: null, change7dPercent: null, onTarget: false })
  })

  it('esgotado em todas as lojas → soldout, best null', async () => {
    const db = await testDb()
    const p = await addProduct(db)
    for (let i = 0; i < 2; i++) {
      const l = await addListing(db, p.id, { status: 'unavailable' })
      await addSnapshot(db, l.id, { available: false, cashPriceCents: null, installmentPriceCents: null, installmentCount: null, capturedAt: daysAgo(0) })
    }
    const [summary] = await listSummaries(db, 'cash', NOW)
    expect(summary).toMatchObject({ state: 'soldout', best: null })
  })

  it('usa o último snapshot de cada anúncio', async () => {
    const db = await testDb()
    const p = await addProduct(db)
    const l = await addListing(db, p.id, { status: 'ok' })
    await addSnapshot(db, l.id, { cashPriceCents: 80000, capturedAt: daysAgo(2) })
    await addSnapshot(db, l.id, { cashPriceCents: 99000, capturedAt: daysAgo(0) })
    const [summary] = await listSummaries(db, 'cash', NOW)
    expect(summary!.state).toBe('ok')
    expect(summary!.best!.cashPriceCents).toBe(99000)
  })

  it('change7dPercent compara com o preço de 7 dias atrás', async () => {
    const db = await testDb()
    const p = await addProduct(db)
    const l = await addListing(db, p.id)
    await addSnapshot(db, l.id, { cashPriceCents: 100000, capturedAt: daysAgo(8) })
    await addSnapshot(db, l.id, { cashPriceCents: 90000, capturedAt: daysAgo(0) })
    const [summary] = await listSummaries(db, 'cash', NOW)
    expect(summary!.change7dPercent).toBe(-10)
  })

  it('change7dPercent null sem dado de 7 dias atrás', async () => {
    const db = await testDb()
    const p = await addProduct(db)
    const l = await addListing(db, p.id)
    await addSnapshot(db, l.id, { capturedAt: daysAgo(3) })
    const [summary] = await listSummaries(db, 'cash', NOW)
    expect(summary!.change7dPercent).toBeNull()
  })

  it('onTarget usa o targetMode do produto', async () => {
    const db = await testDb()
    const hit = await addProduct(db, { name: 'alvo ok', targetPriceCents: 95000, targetMode: 'installment' })
    const miss = await addProduct(db, { name: 'alvo não', targetPriceCents: 89000, targetMode: 'installment' })
    for (const p of [hit, miss]) {
      const l = await addListing(db, p.id)
      await addSnapshot(db, l.id, { cashPriceCents: 90000, installmentPriceCents: 94000, capturedAt: daysAgo(0) })
    }
    const summaries = await listSummaries(db, 'cash', NOW)
    expect(summaries.find(s => s.id === hit.id)!.onTarget).toBe(true)
    expect(summaries.find(s => s.id === miss.id)!.onTarget).toBe(false)
  })

  it('hasError quando um anúncio está com erro', async () => {
    const db = await testDb()
    const p = await addProduct(db)
    await addListing(db, p.id, { status: 'ok' })
    await addListing(db, p.id, { status: 'error', lastError: 'Bloqueado pela loja' })
    const [summary] = await listSummaries(db, 'cash', NOW)
    expect(summary!.hasError).toBe(true)
  })

  it('não inclui arquivados', async () => {
    const db = await testDb()
    await addProduct(db, { archived: true })
    expect(await listSummaries(db, 'cash', NOW)).toEqual([])
  })
})

describe('getProductDetail', () => {
  it('ordena lojas pelo preço e calcula menor preço já visto e preço de 7 dias', async () => {
    const db = await testDb()
    const p = await addProduct(db)
    const cheap = await addListing(db, p.id, { store: 'amazon', url: 'https://www.amazon.com.br/dp/B000000001' })
    const pricey = await addListing(db, p.id, { store: 'kabum' })
    const soldout = await addListing(db, p.id, { store: 'kabum', status: 'unavailable' })
    await addSnapshot(db, cheap.id, { cashPriceCents: 70000, capturedAt: daysAgo(10) })
    await addSnapshot(db, cheap.id, { cashPriceCents: 85000, capturedAt: daysAgo(0) })
    await addSnapshot(db, pricey.id, { cashPriceCents: 90000, capturedAt: daysAgo(0) })
    await addSnapshot(db, soldout.id, { available: false, cashPriceCents: null, installmentPriceCents: null, installmentCount: null, capturedAt: daysAgo(0) })

    const detail = await getProductDetail(db, p.id, 'cash', NOW)
    expect(detail!.stores.map(s => s.listingId)).toEqual([cheap.id, pricey.id, soldout.id])
    expect(detail!.best!.listingId).toBe(cheap.id)
    expect(detail!.lowestEver).toEqual({ cents: 70000, store: 'amazon', at: daysAgo(10) })
    expect(detail!.price7dAgo).toBe(70000)
  })

  it('produto inexistente → null', async () => {
    const db = await testDb()
    expect(await getProductDetail(db, 999, 'cash', NOW)).toBeNull()
  })
})

describe('getHistory', () => {
  it('filtra pelo período, um item por anúncio, pontos em ordem', async () => {
    const db = await testDb()
    const p = await addProduct(db)
    const l = await addListing(db, p.id)
    await addSnapshot(db, l.id, { cashPriceCents: 3, capturedAt: daysAgo(1) })
    await addSnapshot(db, l.id, { cashPriceCents: 1, capturedAt: daysAgo(40) })
    await addSnapshot(db, l.id, { cashPriceCents: 2, capturedAt: daysAgo(20) })

    expect((await getHistory(db, p.id, '7d', NOW))[0]!.points).toHaveLength(1)
    expect((await getHistory(db, p.id, '30d', NOW))[0]!.points).toHaveLength(2)
    const all = await getHistory(db, p.id, 'all', NOW)
    expect(all).toHaveLength(1)
    expect(all[0]!.points.map(pt => pt.cash)).toEqual([1, 2, 3])
    expect(all[0]!).toMatchObject({ listingId: l.id, store: 'kabum' })
  })
})
