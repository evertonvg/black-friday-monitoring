import { createDb, type Db } from '../db/client'

let dbPromise: Promise<Db> | undefined

/** Banco compartilhado pelas rotas e pelo agendador. */
export function useDb(): Promise<Db> {
  dbPromise ??= createDb(process.env.DATABASE_PATH ?? './data/app.db')
  return dbPromise
}
