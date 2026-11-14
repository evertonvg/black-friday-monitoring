import { removeListing } from '../../services/products'

export default defineEventHandler(async (event) => {
  const id = await readIdParam(event)
  if (!(await removeListing(await useDb(), id))) {
    throw createError({ statusCode: 404, statusMessage: 'Anúncio não encontrado' })
  }
  setResponseStatus(event, 204)
  return null
})
