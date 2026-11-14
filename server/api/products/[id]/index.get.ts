import { z } from 'zod'
import { priceModeSchema } from '../../../services/products'
import { getProductDetail } from '../../../services/prices'

export default defineEventHandler(async (event) => {
  const id = await readIdParam(event)
  const { mode } = await getValidatedQuery(event, z.object({ mode: priceModeSchema.default('cash') }).parse)
  const detail = await getProductDetail(await useDb(), id, mode)
  if (!detail) throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado' })
  return detail
})
