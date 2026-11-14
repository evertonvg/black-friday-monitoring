import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from './schema'

export type Db = ReturnType<typeof drizzle<typeof schema>>

function migrationsDir(): string {
  return resolve(process.cwd(), process.env.MIGRATIONS_DIR ?? 'server/db/migrations')
}

/** Abre o SQLite (arquivo ou ':memory:'), aplica PRAGMAs e migrações. */
export async function createDb(path: string): Promise<Db> {
  const inMemory = path === ':memory:'
  if (!inMemory) mkdirSync(dirname(resolve(path)), { recursive: true })

  const client = createClient({ url: inMemory ? ':memory:' : `file:${resolve(path)}` })
  if (!inMemory) await client.execute('PRAGMA journal_mode = WAL')
  await client.execute('PRAGMA busy_timeout = 5000')
  await client.execute('PRAGMA foreign_keys = ON')

  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: migrationsDir() })
  return db
}

/** True quando o erro (ou a causa embrulhada pelo Drizzle) é violação de UNIQUE. */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  while (current instanceof Error) {
    if (/UNIQUE constraint failed/i.test(current.message)) return true
    current = current.cause
  }
  return false
}
