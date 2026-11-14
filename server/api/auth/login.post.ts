import { z } from 'zod'
import { checkPassword } from '../../lib/password'

const FAILED_LOGIN_DELAY_MS = 500

export default defineEventHandler(async (event) => {
  const { password } = await readValidatedBody(event, z.object({ password: z.string() }).parse)
  if (!checkPassword(password, process.env.APP_PASSWORD ?? '')) {
    await new Promise(resolve => setTimeout(resolve, FAILED_LOGIN_DELAY_MS))
    throw createError({ statusCode: 401, statusMessage: 'Senha incorreta' })
  }
  await setUserSession(event, { user: { name: 'owner' } })
  setResponseStatus(event, 204)
  return null
})
