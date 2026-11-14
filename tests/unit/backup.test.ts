import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { createDb } from '../../server/db/client'
import { backupDb } from '../../server/collector/backup'

describe('backupDb', () => {
  it('cria o backup do dia e mantém só os 7 mais recentes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bfm-'))
    const db = await createDb(join(dir, 'app.db'))
    const backups = join(dir, 'backups')
    await backupDb(db, backups, new Date('2026-11-01T12:00:00Z'))
    for (let day = 2; day <= 8; day++) writeFileSync(join(backups, `app-2026-11-0${day}.db`), '')

    const path = await backupDb(db, backups, new Date('2026-11-09T12:00:00Z'))

    expect(path).toBe(join(backups, 'app-2026-11-09.db'))
    expect(existsSync(path)).toBe(true)
    const files = readdirSync(backups).sort()
    expect(files).toHaveLength(7)
    expect(files[0]).toBe('app-2026-11-03.db')
  })
})
