import { fetchHtml } from '../http'
import type { StoreAdapter } from '../types'
import { parseListing, parseSearch } from './parse'
import { matches, normalizeUrl } from './url'

export const kabum: StoreAdapter = {
  id: 'kabum',
  name: 'KaBuM!',
  matches,
  normalizeUrl,
  async search(term, signal) {
    const slug = encodeURIComponent(term.trim().toLowerCase().replace(/\s+/g, '-'))
    return parseSearch(await fetchHtml('kabum', `https://www.kabum.com.br/busca/${slug}`, { signal }))
  },
  async fetchListing(url) {
    return parseListing(await fetchHtml('kabum', normalizeUrl(url)))
  }
}
