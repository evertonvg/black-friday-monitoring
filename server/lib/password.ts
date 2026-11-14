import { createHash, timingSafeEqual } from 'node:crypto'

const digest = (value: string) => createHash('sha256').update(value).digest()

/** Compara em tempo constante; senha esperada vazia nunca é aceita. */
export function checkPassword(given: string, expected: string): boolean {
  if (!expected) return false
  return timingSafeEqual(digest(given), digest(expected))
}
