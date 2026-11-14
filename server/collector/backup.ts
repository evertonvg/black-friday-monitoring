import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import type { Db } from '../db/client'

const KEEP = 7
const BACKUP_FILE = /^app-\d{4}-\d{2}-\d{2}\.db$/

/** Copia o banco para <dir>/app-AAAA-MM-DD.db e mantém só os 7 backups mais recentes. */
export async function backupDb(db: Db, dir: string, now: Date = new Date()): Promise<string> {
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `app-${now.toISOString().slice(0, 10)}.db`)
  rmSync(path, { force: true }) // VACUUM INTO falha se o arquivo já existe
  await db.run(sql.raw(`VACUUM INTO '${path.replace(/'/g, '\'\'')}'`))

  const backups = readdirSync(dir).filter(name => BACKUP_FILE.test(name)).sort()
  for (const old of backups.slice(0, Math.max(0, backups.length - KEEP))) {
    rmSync(join(dir, old), { force: true })
  }
  return path
}
