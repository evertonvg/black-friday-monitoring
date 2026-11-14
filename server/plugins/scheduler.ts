import { dirname, join, resolve } from 'node:path'
import { Cron } from 'croner'
import { backupDb } from '../collector/backup'
import { runCycle } from '../collector/collect'

const TIMEZONE = 'America/Sao_Paulo'

export default defineNitroPlugin(() => {
  if (process.env.COLLECT_ENABLED === 'false') {
    console.info('[coleta] agendador desligado (COLLECT_ENABLED=false)')
    return
  }

  const pattern = process.env.COLLECT_CRON || '0 */3 * * *'
  const backupDir = join(dirname(resolve(process.env.DATABASE_PATH ?? './data/app.db')), 'backups')

  new Cron(pattern, { timezone: TIMEZONE, protect: true }, async () => {
    const startedAt = Date.now()
    console.info('[coleta] ciclo iniciado')
    try {
      const { skipped, results } = await runCycle(await useDb())
      if (skipped) return console.info('[coleta] ciclo anterior ainda rodando, pulando')
      const failed = results.filter(r => !r.ok).length
      console.info(`[coleta] ciclo concluído em ${Math.round((Date.now() - startedAt) / 1000)}s: ${results.length - failed} ok, ${failed} com erro`)
    } catch (error) {
      console.error('[coleta] ciclo falhou', error)
    }
  })

  new Cron('0 4 * * *', { timezone: TIMEZONE, protect: true }, async () => {
    try {
      console.info(`[backup] salvo em ${await backupDb(await useDb(), backupDir)}`)
    } catch (error) {
      console.error('[backup] falhou', error)
    }
  })

  console.info(`[coleta] agendador ativo: "${pattern}" (${TIMEZONE}); backup diário às 04:00`)
})
