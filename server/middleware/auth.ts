// Toda a API exige sessão, exceto o login e o endpoint de sessão do nuxt-auth-utils.
const PUBLIC_API = ['/api/auth/login', '/api/_auth/']

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return
  if (PUBLIC_API.some(prefix => path.startsWith(prefix))) return
  await requireUserSession(event)
})
