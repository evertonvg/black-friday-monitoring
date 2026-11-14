import * as cheerio from 'cheerio'
import { parseBRL } from '../../lib/money'
import { BlockedError } from '../errors'
import type { ListingPage, SearchResult } from '../types'
import { productUrl } from './url'

function load(html: string): cheerio.CheerioAPI {
  // Captcha clássico ou desafio anti-bot "interstitial" (bm-verify): a loja bloqueou o acesso.
  if (/\/errors\/validateCaptcha|Digite os caracteres|triggerInterstitialChallenge|bm-verify/i.test(html)) {
    throw new BlockedError()
  }
  return cheerio.load(html)
}

const clean = (text: string) => text.replace(/\s+/g, ' ').trim()

export function parseSearch(html: string): SearchResult[] {
  const $ = load(html)
  const seen = new Set<string>()
  const results: SearchResult[] = []

  $('[data-component-type="s-search-result"]').each((_, el) => {
    const item = $(el)
    const asin = item.attr('data-asin')?.trim()
    if (!asin || seen.has(asin)) return
    const title = clean(item.find('h2').first().text())
    if (!title) return
    seen.add(asin)
    results.push({
      store: 'amazon',
      url: productUrl(asin),
      title,
      imageUrl: item.find('img.s-image').attr('src') || undefined,
      cashPriceCents: parseBRL(item.find('.a-price .a-offscreen').first().text()) ?? undefined
    })
  })
  return results
}

export function parseListing(html: string): ListingPage {
  const $ = load(html)
  const title = clean($('#productTitle').text())
  if (!title) throw new Error('Página da Amazon sem produto')

  const cash = parseBRL($('#corePrice_feature_div .a-offscreen').first().text())
    ?? parseBRL($('#apex_desktop .a-price:not(.a-text-price) .a-offscreen').first().text())
  const availabilityText = clean($('#availability').text())
  const unavailable = /não disponível|indisponível/i.test(availabilityText)
  // Sem preço e sem aviso de indisponível: o layout mudou. É erro, não "esgotado".
  if (!unavailable && cash === null) throw new Error('Preço não encontrado na página da Amazon')
  const available = !unavailable

  // "Em até 12x de R$ 202,60 sem juros (total parcelado R$ 2.429,99)"
  const installmentText = clean($('#installmentCalculatorCentral_feature_div, #installmentCalculator_feature_div').text())
  const countMatch = installmentText.match(/(\d{1,2})x de (R\$\s?[\d.,]+)/)
  const totalMatch = installmentText.match(/total parcelado (R\$\s?[\d.,]+)/i)
  const count = countMatch ? Number(countMatch[1]) : null
  const each = countMatch ? parseBRL(countMatch[2]!) : null
  const installmentTotal = totalMatch
    ? parseBRL(totalMatch[1]!)
    : count && each ? count * each : null

  // Frete grátis só quando não é condicionado ao primeiro pedido.
  const delivery = clean($('#mir-layout-DELIVERY_BLOCK').text())
  const freeShipping = /entrega grátis/i.test(delivery) && !/primeiro pedido/i.test(delivery)

  return {
    title,
    imageUrl: $('#landingImage').attr('src') || undefined,
    cashPriceCents: available ? cash : null,
    installmentPriceCents: available ? installmentTotal : null,
    installmentCount: available && installmentTotal ? count : null,
    available,
    freeShipping: available && freeShipping
  }
}
