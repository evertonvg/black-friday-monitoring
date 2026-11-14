import { afterEach, describe, it, expect } from 'vitest'
import { findAdapterByUrl, registerAdapter, resetAdapters } from '../../server/stores/registry'
import { UnsupportedStoreError } from '../../server/stores/errors'
import type { StoreAdapter } from '../../server/stores/types'

const fake: StoreAdapter = {
  id: 'kabum',
  name: 'Loja Teste',
  matches: url => new URL(url).hostname === 'loja.test',
  normalizeUrl: url => url,
  search: async () => [],
  fetchListing: async () => { throw new Error('não usado') }
}

afterEach(() => resetAdapters())

describe('findAdapterByUrl', () => {
  it('encontra o adaptador pelo host', () => {
    registerAdapter(fake)
    expect(findAdapterByUrl('https://loja.test/p/1')).toBe(fake)
  })

  it('loja desconhecida → UnsupportedStoreError', () => {
    registerAdapter(fake)
    expect(() => findAdapterByUrl('https://outra.com/x')).toThrow(UnsupportedStoreError)
  })

  it('texto que não é URL → UnsupportedStoreError', () => {
    registerAdapter(fake)
    expect(() => findAdapterByUrl('não é url')).toThrow(UnsupportedStoreError)
  })
})
