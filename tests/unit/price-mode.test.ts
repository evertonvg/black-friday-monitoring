import { describe, it, expect } from 'vitest'
import { readStoredMode, storeMode, PRICE_MODE_KEY } from '../../app/utils/price-mode'

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial }
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => { data[k] = v }
  }
}

const throwing = {
  getItem: () => { throw new Error('bloqueado') },
  setItem: () => { throw new Error('bloqueado') }
}

describe('modo de preço salvo', () => {
  it('lê installment salvo', () =>
    expect(readStoredMode(memory({ [PRICE_MODE_KEY]: 'installment' }))).toBe('installment'))
  it('valor inválido → cash', () =>
    expect(readStoredMode(memory({ [PRICE_MODE_KEY]: 'parcelado' }))).toBe('cash'))
  it('storage indisponível → cash', () => expect(readStoredMode(undefined)).toBe('cash'))
  it('storage que lança → cash sem erro', () => expect(readStoredMode(throwing)).toBe('cash'))
  it('grava o modo', () => {
    const storage = memory()
    storeMode(storage, 'installment')
    expect(storage.data[PRICE_MODE_KEY]).toBe('installment')
  })
  it('gravar em storage que lança não quebra', () =>
    expect(() => storeMode(throwing, 'cash')).not.toThrow())
})
