import { z } from 'zod'
import type { PriceSnapshotInput } from './types'

const price = z.number().int().positive().nullable()

export const snapshotSchema = z.object({
  cashPriceCents: price,
  installmentPriceCents: price,
  installmentCount: z.number().int().min(1).max(48).nullable(),
  available: z.boolean(),
  freeShipping: z.boolean()
}).refine(
  s => !s.available || s.cashPriceCents !== null || s.installmentPriceCents !== null,
  { message: 'Produto disponível sem nenhum preço' }
)

/** Valida o retrato de preço vindo de um adaptador; lança ZodError se inválido. */
export function validateSnapshot(input: unknown): PriceSnapshotInput {
  return snapshotSchema.parse(input)
}
