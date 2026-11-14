import { reaisToCents } from '../../lib/money'
import type { ListingPage, SearchResult } from '../types'
import { productUrl } from './url'

/* Campos usados do JSON __NEXT_DATA__ do KaBuM (só o que lemos). */
interface KabumSearchItem {
  code: number
  name: string
  image?: string
  price?: number
  priceWithDiscount?: number
  available?: boolean
  offer?: { price?: number, priceWithDiscount?: number } | null
}

interface KabumProduct {
  title?: string
  thumbnail?: string
  available?: boolean
  prices?: { price?: number, priceWithDiscount?: number }
  installment?: { installment?: number }
  flags?: { isFreeShipping?: boolean, isAvailable?: boolean }
}

function nextData(html: string): any {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!match) throw new Error('Página do KaBuM sem dados (__NEXT_DATA__)')
  return JSON.parse(match[1]!)
}

export function parseSearch(html: string): SearchResult[] {
  // Em páginas de categoria o KaBuM entrega "data" como texto JSON.
  const raw = nextData(html)?.props?.pageProps?.data
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw
  const items: KabumSearchItem[] = data?.catalogServer?.data ?? []
  return items.map(item => ({
    store: 'kabum' as const,
    url: productUrl(item.code),
    title: item.name,
    imageUrl: item.image || undefined,
    cashPriceCents: reaisToCents(item.offer?.priceWithDiscount ?? item.priceWithDiscount) ?? undefined
  }))
}

export function parseListing(html: string): ListingPage {
  const product: KabumProduct | undefined = nextData(html)?.props?.pageProps?.product
  if (!product?.title) throw new Error('Página do KaBuM sem produto')

  const available = Boolean(product.available && product.flags?.isAvailable !== false)
  const cash = available ? reaisToCents(product.prices?.priceWithDiscount) : null
  const installment = available ? reaisToCents(product.prices?.price) : null
  const count = product.installment?.installment

  return {
    title: product.title.trim(),
    imageUrl: product.thumbnail || undefined,
    cashPriceCents: cash,
    installmentPriceCents: installment,
    installmentCount: installment && count && count > 0 ? count : null,
    available,
    freeShipping: Boolean(product.flags?.isFreeShipping)
  }
}
