import { z } from 'zod'
import { getAdapter } from '../../stores/registry'
import { storeIdSchema } from '../../services/products'

const SEARCH_TIMEOUT_MS = 20_000

export default defineEventHandler(async (event) => {
  const { store } = await getValidatedRouterParams(event, z.object({ store: storeIdSchema }).parse)
  const { q } = await getValidatedQuery(event, z.object({ q: z.string().trim().min(2).max(100) }).parse)
  const signal = AbortSignal.timeout(SEARCH_TIMEOUT_MS)
  try {
    return { results: await getAdapter(store).search(q, signal) }
  } catch (error) {
    if (signal.aborted) throw createError({ statusCode: 504, statusMessage: 'A loja não respondeu' })
    throw toHttpError(error)
  }
})
