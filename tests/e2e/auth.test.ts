import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { fetch, setup } from '@nuxt/test-utils/e2e'

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  setupTimeout: 300_000,
  env: {
    APP_PASSWORD: 'teste123',
    NUXT_APP_SECRET: 'uma-senha-de-sessao-bem-longa-para-teste-0123456789',
    DATABASE_PATH: ':memory:',
    COLLECT_ENABLED: 'false'
  }
})

const login = (password: string) => fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ password })
})

describe('acesso com senha', () => {
  it('API sem sessão → 401', async () => {
    const r = await fetch('/api/products')
    expect(r.status).toBe(401)
  })

  it('senha errada → 401', async () => {
    expect((await login('errada')).status).toBe(401)
  })

  it('senha certa → 204 e o cookie libera a API', async () => {
    const response = await login('teste123')
    expect(response.status).toBe(204)
    const cookie = response.headers.get('set-cookie')!.split(';')[0]!
    const products = await fetch('/api/products', { headers: { cookie } })
    expect(products.status).toBe(200)
  })

  it('página sem sessão redireciona para /login', async () => {
    const response = await fetch('/', { redirect: 'manual' })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
  })
})
