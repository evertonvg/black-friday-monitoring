import { UnsupportedStoreError } from './errors'
import { kabum } from './kabum'
import type { StoreAdapter, StoreId } from './types'

const defaultAdapters: StoreAdapter[] = [kabum]

let adapters: StoreAdapter[] = [...defaultAdapters]

export function listAdapters(): readonly StoreAdapter[] {
  return adapters
}

export function getAdapter(id: StoreId): StoreAdapter {
  const adapter = adapters.find(a => a.id === id)
  if (!adapter) throw new UnsupportedStoreError()
  return adapter
}

export function findAdapterByUrl(url: string): StoreAdapter {
  try {
    new URL(url)
  } catch {
    throw new UnsupportedStoreError()
  }
  const adapter = adapters.find(a => a.matches(url))
  if (!adapter) throw new UnsupportedStoreError()
  return adapter
}

/** Só para testes: adiciona um adaptador na frente da lista. */
export function registerAdapter(adapter: StoreAdapter): void {
  adapters = [adapter, ...adapters]
}

/** Só para testes: volta à lista padrão. */
export function resetAdapters(): void {
  adapters = [...defaultAdapters]
}
