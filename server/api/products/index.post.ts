import { collectProduct } from '../../collector/collect'
import { createProduct, createProductSchema } from '../../services/products'

export default defineEventHandler(async (event) => {
  const input = await readValidatedBody(event, createProductSchema.parse)
  const db = await useDb()
  try {
    const product = await createProduct(db, input)
    // Primeira coleta em segundo plano; a tela de detalhe acompanha os anúncios "pending".
    collectProduct(db, product.id).catch(error => console.error('[coleta] primeira coleta falhou', error))
    setResponseStatus(event, 201)
    return product
  } catch (error) {
    throw toHttpError(error)
  }
})
