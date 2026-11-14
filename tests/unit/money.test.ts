import { describe, it, expect } from 'vitest'
import { parseBRL, formatBRL } from '../../server/lib/money'

describe('parseBRL', () => {
  it.each([
    ['R$ 1.299,90', 129990],
    ['R$1.299', 129900],
    ['1.299,9', 129990],
    ['R$ 89,00', 8900],
    [' R$ 2.499,00 ', 249900],
    ['12x de R$ 108,33', 10833]
  ])('%s -> %i', (input, expected) => expect(parseBRL(input)).toBe(expected))

  it.each(['', 'Indisponível', 'R$ ', 'R$ 0,00'])('%s -> null', input =>
    expect(parseBRL(input)).toBeNull())
})

describe('formatBRL', () => {
  it('formata em pt-BR', () => expect(formatBRL(129990)).toBe('R$ 1.299,90'))
})
