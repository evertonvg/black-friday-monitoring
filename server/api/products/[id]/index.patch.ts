import { updateProduct, updateProductSchema } from '../../../services/products'

export default defineEventHandler(async (event) => {
  const id = await readIdParam(event)
  const patch = await readValidatedBody(event, updateProductSchema.parse)
  const product = await updateProduct(await useDb(), id, patch)
  if (!product) throw createError({ statusCode: 404, statusMessage: 'Produto não encontrado' })
  return product
})
