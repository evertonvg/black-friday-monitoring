import { describe, it, expect } from 'vitest'
import { validateSnapshot } from '../../server/stores/validate'

const valid = {
  cashPriceCents: 249900,
  installmentPriceCents: 279900,
  installmentCount: 10,
  available: true,
  freeShipping: false
}

describe('validateSnapshot', () => {
  it('aceita snapshot válido', () => expect(validateSnapshot(valid)).toEqual(valid))

  it('aceita esgotado sem preços', () => {
    const soldout = { cashPriceCents: null, installmentPriceCents: null, installmentCount: null, available: false, freeShipping: false }
    expect(validateSnapshot(soldout)).toEqual(soldout)
  })

  it('rejeita disponível sem nenhum preço', () =>
    expect(() => validateSnapshot({ ...valid, cashPriceCents: null, installmentPriceCents: null })).toThrow())

  it.each([0, -1, 12.5])('rejeita preço %s', price =>
    expect(() => validateSnapshot({ ...valid, cashPriceCents: price })).toThrow())

  it.each([0, 60])('rejeita %s parcelas', count =>
    expect(() => validateSnapshot({ ...valid, installmentCount: count })).toThrow())
})
