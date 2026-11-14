import { z } from 'zod'
import { findAdapterByUrl } from '../stores/registry'

export default defineEventHandler(async (event) => {
  const { url } = await readValidatedBody(event, z.object({ url: z.string().trim().min(1) }).parse)
  try {
    const adapter = findAdapterByUrl(url)
    const canonical = adapter.normalizeUrl(url)
    const page = await adapter.fetchListing(canonical)
    return {
      store: adapter.id,
      url: canonical,
      title: page.title,
      imageUrl: page.imageUrl,
      cashPriceCents: page.cashPriceCents
    }
  } catch (error) {
    throw toHttpError(error)
  }
})
