import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { parseListing, parseSearch } from '../../../server/stores/kabum/parse'
import { matches, normalizeUrl } from '../../../server/stores/kabum/url'
import { validateSnapshot } from '../../../server/stores/validate'

const fixture = (name: string) => readFileSync(`tests/fixtures/kabum/${name}.html`, 'utf8')

/** Copia a página de produto trocando campos do JSON (para simular esgotado). */
function withProduct(html: string, patch: (p: Record<string, any>) => void): string {
  const json = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)![1]!
  const data = JSON.parse(json)
  patch(data.props.pageProps.product)
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></body></html>`
}

describe('kabum parseSearch', () => {
  const results = parseSearch(fixture('search'))

  it('extrai os resultados com URL canônica', () => {
    expect(results.length).toBeGreaterThanOrEqual(5)
    for (const r of results) {
      expect(r.store).toBe('kabum')
      expect(r.url).toMatch(/^https:\/\/www\.kabum\.com\.br\/produto\/\d+$/)
      expect(r.title).not.toBe('')
    }
  })

  it('primeiro resultado igual ao da página', () => {
    expect(results[0]).toMatchObject({
      url: 'https://www.kabum.com.br/produto/911482',
      title: 'Smart TV TCL 55 Polegadas QD-Mini LED 4K C6K WiFi Bluetooth Google TV 4 HDMI 144Hz HDR10+ 55C6K',
      cashPriceCents: 350477
    })
    expect(results[0]!.imageUrl).toMatch(/^https:\/\/images\.kabum\.com\.br\//)
  })

  it('usa o preço da oferta quando há oferta ativa', () => {
    expect(results.find(r => r.url.endsWith('/1034609'))?.cashPriceCents).toBe(229900)
  })
})

describe('kabum parseSearch em página de categoria', () => {
  it('lê o JSON que vem como texto quando a busca vira categoria', () => {
    const results = parseSearch(fixture('search-category'))
    expect(results).toHaveLength(60)
    expect(results[0]).toMatchObject({ url: 'https://www.kabum.com.br/produto/105104', cashPriceCents: 15499 })
  })
})

describe('kabum parseListing', () => {
  it('produto disponível', () => {
    const page = parseListing(fixture('product'))
    expect(page).toMatchObject({
      title: 'Smart TV TCL 55 Polegadas QD-Mini LED 4K C6K WiFi Bluetooth Google TV 4 HDMI 144Hz HDR10+ 55C6K',
      cashPriceCents: 350477,
      installmentPriceCents: 389419,
      installmentCount: 10,
      available: true,
      freeShipping: false
    })
    expect(page.imageUrl).toMatch(/^https:\/\/images\.kabum\.com\.br\//)
    expect(() => validateSnapshot(page)).not.toThrow()
  })

  it('produto em oferta usa os preços com a oferta', () => {
    expect(parseListing(fixture('offer'))).toMatchObject({
      cashPriceCents: 229900,
      installmentPriceCents: 247204,
      installmentCount: 10,
      available: true
    })
  })

  it('produto esgotado', () => {
    const html = withProduct(fixture('product'), (p) => {
      p.available = false
      p.flags.isAvailable = false
      p.prices = { oldPrice: 0, priceWithDiscount: 0, price: 0, discountPercentage: 0 }
    })
    expect(parseListing(html)).toMatchObject({
      available: false,
      cashPriceCents: null,
      installmentPriceCents: null
    })
  })

  it('página sem dados de produto lança erro', () => {
    expect(() => parseListing('<html><body>nada aqui</body></html>')).toThrow()
  })
})

describe('kabum url', () => {
  it('reconhece o domínio', () => {
    expect(matches('https://www.kabum.com.br/produto/123456')).toBe(true)
    expect(matches('https://kabum.com.br/produto/123456')).toBe(true)
    expect(matches('https://www.amazon.com.br/dp/B0C1234567')).toBe(false)
  })

  it('normaliza descartando slug e parâmetros', () => {
    expect(normalizeUrl('https://www.kabum.com.br/produto/123456/tv-55?utm_source=x#topo'))
      .toBe('https://www.kabum.com.br/produto/123456')
    expect(normalizeUrl('https://kabum.com.br/produto/123456')).toBe('https://www.kabum.com.br/produto/123456')
  })

  it('URL que não é de produto lança erro', () => {
    expect(() => normalizeUrl('https://www.kabum.com.br/busca/tv')).toThrow()
  })
})
