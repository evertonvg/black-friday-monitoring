import { createDb, type Db } from '../../server/db/client'

export function testDb(): Promise<Db> {
  return createDb(':memory:')
}
