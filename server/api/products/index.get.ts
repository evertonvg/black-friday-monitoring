import { z } from 'zod'
import { priceModeSchema } from '../../services/products'
import { listSummaries } from '../../services/prices'

export default defineEventHandler(async (event) => {
  const { mode } = await getValidatedQuery(event, z.object({ mode: priceModeSchema.default('cash') }).parse)
  return listSummaries(await useDb(), mode)
})
