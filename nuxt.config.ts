import { createRequire } from 'node:module'

/**
 * O pacote `libsql` carrega o binário nativo por um nome dinâmico (@libsql/<plataforma>),
 * que o rastreador do Nitro não enxerga. Resolve o binário da plataforma do build
 * (Linux no Docker) para que ele vá junto em .output.
 */
function libsqlNativeBinary(): string[] {
  const suffix = process.platform === 'win32' ? '-msvc' : process.platform === 'linux' ? '-gnu' : ''
  try {
    const fromRoot = createRequire(`${process.cwd()}/package.json`)
    const fromClient = createRequire(fromRoot.resolve('@libsql/client'))
    const fromLibsql = createRequire(fromClient.resolve('libsql'))
    return [fromLibsql.resolve(`@libsql/${process.platform}-${process.arch}${suffix}`)]
  } catch {
    return []
  }
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    'nuxt-auth-utils'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2026-06-30',

  nitro: {
    externals: {
      traceInclude: libsqlNativeBinary()
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
