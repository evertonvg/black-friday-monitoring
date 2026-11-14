import { collectListing } from '../../../collector/collect'
import { addListing, newListingSchema } from '../../../services/products'

export default defineEventHandler(async (event) => {
  const id = await readIdParam(event)
  const input = await readValidatedBody(event, newListingSchema.parse)
  const db = await useDb()
  try {
    const listing = await addListing(db, id, input)
    collectListing(db, listing.id).catch(error => console.error('[coleta] coleta do anúncio falhou', error))
    setResponseStatus(event, 201)
    return listing
  } catch (error) {
    throw toHttpError(error)
  }
})
