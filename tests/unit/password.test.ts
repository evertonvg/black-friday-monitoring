import { describe, it, expect } from 'vitest'
import { checkPassword } from '../../server/lib/password'

describe('checkPassword', () => {
  it('senha certa', () => expect(checkPassword('segredo123', 'segredo123')).toBe(true))
  it('senha errada', () => expect(checkPassword('segredo124', 'segredo123')).toBe(false))
  it('tamanhos diferentes sem lançar', () => expect(checkPassword('s', 'segredo123')).toBe(false))
  it('senha esperada vazia nunca aceita', () => expect(checkPassword('', '')).toBe(false))
})
