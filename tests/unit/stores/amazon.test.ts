import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { parseListing, parseSearch } from '../../../server/stores/amazon/parse'
import { matches, normalizeUrl } from '../../../server/stores/amazon/url'
import { BlockedError, ShortLinkError } from '../../../server/stores/errors'
import { validateSnapshot } from '../../../server/stores/validate'

const fixture = (name: string) => readFileSync(`tests/fixtures/amazon/${name}.html`, 'utf8')

describe('amazon parseSearch', () => {
  const results = parseSearch(fixture('search'))

  it('extrai resultados únicos por ASIN com URL canônica', () => {
    expect(results).toHaveLength(49)
    for (const r of results) {
      expect(r.store).toBe('amazon')
      expect(r.url).toMatch(/^https:\/\/www\.amazon\.com\.br\/dp\/[A-Z0-9]{10}$/)
      expect(r.title).not.toBe('')
    }
  })

  it('primeiro resultado igual ao da página', () => {
    expect(results[0]).toMatchObject({
      url: 'https://www.amazon.com.br/dp/B0HCRPPXB1',
      title: 'Smart TV LG 55" 4K UHD NANO AI 55UN85CBPSA.BWZ',
      cashPriceCents: 226955
    })
    expect(results[0]!.imageUrl).toMatch(/^https:\/\/m\.media-amazon\.com\//)
  })

  it('captcha na busca → BlockedError', () => {
    expect(() => parseSearch(fixture('captcha'))).toThrow(BlockedError)
  })
})

describe('amazon parseListing', () => {
  it('produto disponível', () => {
    const page = parseListing(fixture('product'))
    expect(page).toMatchObject({
      title: 'Smart TV TCL 55 Polegadas QLED 4K T6C WiFi Bluetooth Google TV Tela HVA e HDR10+ 55T6C',
      cashPriceCents: 242999,
      installmentPriceCents: 242999,
      installmentCount: 12,
      available: true,
      freeShipping: false // "Entrega GRÁTIS ... no seu primeiro pedido" não conta
    })
    expect(page.imageUrl).toMatch(/^https:\/\/m\.media-amazon\.com\//)
    expect(() => validateSnapshot(page)).not.toThrow()
  })

  it('produto indisponível', () => {
    expect(parseListing(fixture('soldout'))).toMatchObject({
      title: 'Console Exemplo Edição Limitada',
      available: false,
      cashPriceCents: null,
      installmentPriceCents: null,
      installmentCount: null
    })
  })

  it('captcha na página do produto → BlockedError', () => {
    expect(() => parseListing(fixture('captcha'))).toThrow(BlockedError)
  })

  it('página sem dados de produto lança erro', () => {
    expect(() => parseListing('<html><body>nada aqui</body></html>')).toThrow()
  })
})

describe('amazon url', () => {
  it('reconhece o domínio', () => {
    expect(matches('https://www.amazon.com.br/dp/B0C1234567')).toBe(true)
    expect(matches('https://amazon.com.br/dp/B0C1234567')).toBe(true)
    expect(matches('https://amzn.to/3xyz')).toBe(true)
    expect(matches('https://www.amazon.com/dp/B0C1234567')).toBe(false)
  })

  it.each([
    'https://www.amazon.com.br/Smart-TV/dp/B0C1234567/ref=sr_1_3?keywords=tv',
    'https://www.amazon.com.br/gp/product/B0C1234567',
    'https://amazon.com.br/dp/B0C1234567?th=1#detalhes'
  ])('normaliza %s', url =>
    expect(normalizeUrl(url)).toBe('https://www.amazon.com.br/dp/B0C1234567'))

  it.each(['https://amzn.to/3xyz', 'https://a.co/d/abc'])('link curto %s → ShortLinkError', url =>
    expect(() => normalizeUrl(url)).toThrow(ShortLinkError))

  it('URL sem ASIN lança erro', () => {
    expect(() => normalizeUrl('https://www.amazon.com.br/s?k=tv')).toThrow()
  })
})
