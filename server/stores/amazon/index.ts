import { fetchHtml } from '../http'
import type { StoreAdapter } from '../types'
import { parseListing, parseSearch } from './parse'
import { matches, normalizeUrl } from './url'

export const amazon: StoreAdapter = {
  id: 'amazon',
  name: 'Amazon',
  matches,
  normalizeUrl,
  async search(term, signal) {
    const url = `https://www.amazon.com.br/s?k=${encodeURIComponent(term.trim())}`
    return parseSearch(await fetchHtml('amazon', url, { signal }))
  },
  async fetchListing(url) {
    return parseListing(await fetchHtml('amazon', normalizeUrl(url)))
  }
}
