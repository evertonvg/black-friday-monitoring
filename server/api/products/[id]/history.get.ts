import { z } from 'zod'
import { getHistory } from '../../../services/prices'

export default defineEventHandler(async (event) => {
  const id = await readIdParam(event)
  const { range } = await getValidatedQuery(event, z.object({ range: z.enum(['7d', '30d', 'all']).default('30d') }).parse)
  return getHistory(await useDb(), id, range)
})
