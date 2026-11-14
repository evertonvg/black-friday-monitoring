import { collectProduct } from '../../../collector/collect'

export default defineEventHandler(async (event) => {
  const id = await readIdParam(event)
  return collectProduct(await useDb(), id)
})
