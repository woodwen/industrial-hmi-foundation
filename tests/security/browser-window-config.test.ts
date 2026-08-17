import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('BrowserWindow security configuration', () => {
  it('enables context isolation and disables node integration', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'main', 'index.ts'), 'utf8')

    expect(source).toContain('contextIsolation: true')
    expect(source).toContain('nodeIntegration: false')
  })
})
